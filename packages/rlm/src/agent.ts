import { reactSystemPrompt, reactUserPrompt } from "@luna/prompts";
import { generateText, type LanguageModel } from "ai";

export interface Tool {
	name: string;
	description: string;
	execute: (input: string) => Promise<string>;
}

export interface AgentResult {
	answer: string;
	steps: AgentStep[];
}

export interface AgentStep {
	thought: string;
	action?: string;
	actionInput?: string;
	observation?: string;
	finalAnswer?: string;
}

export async function reactAgent(
	query: string,
	model: LanguageModel,
	tools: Tool[],
	maxSteps = 10,
): Promise<AgentResult> {
	const toolMap = new Map(tools.map((t) => [t.name, t]));
	const toolNames = tools.map((t) => `${t.name}: ${t.description}`);

	const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
		{ role: "system", content: reactSystemPrompt(toolNames) },
		{ role: "user", content: reactUserPrompt(query) },
	];

	const steps: AgentStep[] = [];

	for (let i = 0; i < maxSteps; i++) {
		const { text: response } = await generateText({ model, messages });
		messages.push({ role: "assistant", content: response });

		const step = parseStep(response);

		if (step.finalAnswer) {
			steps.push(step);
			return { answer: step.finalAnswer, steps };
		}

		if (step.action && toolMap.has(step.action)) {
			const tool = toolMap.get(step.action)!;
			try {
				const observation = await tool.execute(step.actionInput ?? "");
				step.observation = observation;
			} catch (err) {
				step.observation = `Error: ${err instanceof Error ? err.message : String(err)}`;
			}
			messages.push({ role: "user", content: `Observation: ${step.observation}` });
		} else if (step.action) {
			step.observation = `Error: Tool "${step.action}" not found. Available tools: ${tools.map((t) => t.name).join(", ")}`;
			messages.push({ role: "user", content: `Observation: ${step.observation}` });
		}

		steps.push(step);
	}

	return { answer: "Max steps reached without a final answer.", steps };
}

function parseStep(text: string): AgentStep {
	const thoughtMatch = text.match(/Thought:\s*(.+?)(?=\n(?:Action|Final Answer):|$)/s);
	const actionMatch = text.match(/Action:\s*(\S+)/);
	const inputMatch = text.match(/Action Input:\s*(\{[\s\S]*?\}|\S+)/);
	const finalMatch = text.match(/Final Answer:\s*([\s\S]+)/);

	return {
		thought: thoughtMatch?.[1]?.trim() ?? "",
		action: actionMatch?.[1]?.trim(),
		actionInput: inputMatch?.[1]?.trim(),
		finalAnswer: finalMatch?.[1]?.trim(),
	};
}
