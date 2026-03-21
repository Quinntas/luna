import { classifySensitivity, filterInput } from "@luna/guard";
import { queryRelated, searchEntities } from "@luna/knowledge";
import {
	extractFacts,
	formatMemoriesForContext,
	retrieveRelevant,
	storeMemories,
} from "@luna/memory";
import { adaptSystemPrompt, classifyUserMessage, getMood, processMood } from "@luna/personalize";
import {
	agentSystemPrompt,
	buildMoodPrompt,
	buildPersonalityPrompt,
	getMoodStatus,
	LUNA_DEFAULT_PERSONALITY,
} from "@luna/prompts";
import { allBuiltInTools, type ToolDefinition } from "@luna/tools";
import { type AgentTool, reactAgent } from "./react-agent.ts";
import type { AgentConfig, AgentResponse } from "./types.ts";

export async function agentTurn(input: string, config: AgentConfig): Promise<AgentResponse> {
	const model = config.model;
	const startTime = performance.now();

	const safeInput = filterInput(input);
	const sensitivity = classifySensitivity(safeInput);

	const memories = await retrieveRelevant(safeInput, 5);
	const memoryCtx = formatMemoriesForContext(memories);
	const entities = await searchEntities(safeInput, { limit: 5 });
	const knowledgeLines: string[] = [];
	for (const entity of entities) {
		const related = await queryRelated(entity.name, 1);
		if (related.length > 0) {
			const relStr = related
				.slice(0, 5)
				.map((r) => `${r.direction === "outgoing" ? "→" : "←"} ${r.relationType} ${r.entity.name}`)
				.join(", ");
			knowledgeLines.push(`${entity.type}: ${entity.name} | ${relStr}`);
		} else {
			knowledgeLines.push(`${entity.type}: ${entity.name}`);
		}
	}
	const knowledgeCtx = knowledgeLines.join("\n");
	const context = [memoryCtx, knowledgeCtx].filter(Boolean).join("\n\n");

	const personalityPrompt = buildPersonalityPrompt(LUNA_DEFAULT_PERSONALITY);
	const mood = getMood("luna");
	const moodPrompt = buildMoodPrompt(mood.label, mood.intensity, mood.energy);
	const userContext = config.user ? `You are talking to ${config.user}. You know them well.` : "";
	const toolNames = allBuiltInTools.map((t) => `${t.name}: ${t.description}`);
	const cutoffDate = "2024-12-31";
	const currentDate = new Date().toISOString().split("T")[0] ?? cutoffDate;

	const backgroundContext = context
		? `<background_context>\n${context}\n</background_context>`
		: "";
	const systemPrompt = agentSystemPrompt(toolNames, cutoffDate, currentDate);

	const fullPrompt = adaptSystemPrompt(
		[personalityPrompt, moodPrompt, userContext, backgroundContext, systemPrompt]
			.filter(Boolean)
			.join("\n\n"),
	);

	const reactTools: AgentTool[] = allBuiltInTools.map(bridgeTool);

	const providerOptions = {
		google: {
			safetySettings: [
				{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
				{ category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
				{ category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
				{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
				{ category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
			],
		},
	};

	const result = await reactAgent(
		safeInput,
		model,
		reactTools,
		fullPrompt,
		config.history,
		providerOptions,
		config.maxSteps ?? 10,
	);

	const safeAnswer = filterInput(result.answer);

	if (config.history) {
		config.history.push({ role: "user", content: input });
		config.history.push({ role: "assistant", content: safeAnswer });
	}

	const facts = await extractFacts(
		[
			{ role: "user", content: input },
			{ role: "assistant", content: safeAnswer },
		],
		model,
	);
	await storeMemories(facts);

	const event = await classifyUserMessage(input, model);
	const newMood = processMood("luna", event);
	const moodStatus = getMoodStatus(newMood.label, newMood.energy);

	return {
		answer: safeAnswer,
		moodStatus,
		toolCalls: result.toolCalls,
		memoriesExtracted: facts.length,
		sensitivityLevel: sensitivity,
		usage: result.usage,
		durationMs: Math.round(performance.now() - startTime),
	};
}

function bridgeTool(toolDef: ToolDefinition): AgentTool {
	return {
		name: toolDef.name,
		description: toolDef.description,
		parameters: toolDef.schema,
		execute: async (input: unknown) => {
			const result = toolDef.schema.safeParse(input);
			if (!result.success) return `Invalid input: ${result.error.message}`;
			return toolDef.execute(result.data);
		},
	};
}
