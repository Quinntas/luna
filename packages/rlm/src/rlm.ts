import {
	rlmExecutionFeedback,
	rlmFirstTurnPrompt,
	rlmIterationPrompt,
	rlmMaxIterationsFallback,
	rlmNoCodeCorrection,
	rlmSystemPrompt,
} from "@luna/prompts";
import { generateText, type LanguageModel } from "ai";
import { REPL } from "./repl.ts";
import type { RLMConfig, RLMResult, RLMTrajectoryStep } from "./types.ts";

export async function rlmComplete(
	context: string,
	query: string,
	config: RLMConfig,
): Promise<RLMResult> {
	const {
		model,
		subModel = model,
		maxIterations = 20,
		maxOutputChars = 100000,
		memoryLimit = 128,
	} = config;

	const repl = new REPL();
	const trajectory: RLMTrajectoryStep[] = [];

	try {
		await repl.init(memoryLimit);
		repl.loadContext(context);

		const messages: { role: "system" | "user"; content: string }[] = [
			{ role: "system", content: rlmSystemPrompt(query) },
		];

		for (let i = 0; i < maxIterations; i++) {
			const prompt = i === 0 ? rlmFirstTurnPrompt(query) : rlmIterationPrompt(query);
			messages.push({ role: "user", content: prompt });

			const { text: response } = await generateText({ model, messages });
			trajectory.push({ role: "assistant", content: response });

			// Check for FINAL(...) — direct answer
			const finalMatch = response.match(/^\s*FINAL\(([\s\S]*?)\)\s*$/m);
			if (finalMatch?.[1]) {
				const answer = finalMatch[1].trim();
				trajectory.push({ role: "final", content: answer });
				return { answer, iterations: i + 1, trajectory };
			}

			// Check for FINAL_VAR(...)
			const finalVarMatch = response.match(/^\s*FINAL_VAR\((.*?)\)/m);
			if (finalVarMatch?.[1]) {
				const varName = finalVarMatch[1].trim().replace(/^['"]|['"]$/g, "");
				const value = repl.getVariable(varName);
				if (value) {
					trajectory.push({ role: "final", content: value });
					return { answer: value, iterations: i + 1, trajectory };
				}
			}

			// Extract ```repl``` code blocks
			const codeBlocks = extractCodeBlocks(response);

			if (codeBlocks.length === 0) {
				messages.push({
					role: "user",
					content: rlmNoCodeCorrection(response),
				});
				continue;
			}

			for (const code of codeBlocks) {
				const { processedCode, responses } = await resolveLLMQueries(code, subModel);

				const result = await repl.execute(processedCode, responses);
				const output = truncate(result.stdout || result.stderr, maxOutputChars);

				trajectory.push({ role: "execution", content: output, code: processedCode });

				messages.push({
					role: "user",
					content: rlmExecutionFeedback(code, output, []),
				});
			}
		}

		// Max iterations — force final answer
		messages.push({
			role: "user",
			content: rlmMaxIterationsFallback(),
		});
		const { text: fallback } = await generateText({ model, messages });
		return { answer: fallback, iterations: maxIterations, trajectory };
	} finally {
		repl.dispose();
	}
}

function extractCodeBlocks(text: string): string[] {
	const pattern = /```repl\s*\n([\s\S]*?)\n```/g;
	const blocks: string[] = [];
	for (const match of text.matchAll(pattern)) {
		if (match[1]) {
			blocks.push(match[1].trim());
		}
	}
	return blocks;
}

async function resolveLLMQueries(
	code: string,
	model: LanguageModel,
): Promise<{ processedCode: string; responses: string[] }> {
	const responses: string[] = [];

	const pattern = /llm_query\(\s*([`"'"])([\s\S]*?)\1\s*\)/g;

	const matches = [...code.matchAll(pattern)];

	for (const match of matches) {
		const prompt = match[2];
		try {
			const { text } = await generateText({ model, prompt });
			responses.push(text);
		} catch {
			responses.push("Error: LLM query failed");
		}
	}

	const processedCode = code.replace(pattern, 'llm_query("__PLACEHOLDER__")');

	return { processedCode, responses };
}

function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max)}\n...[truncated at ${max} chars]`;
}
