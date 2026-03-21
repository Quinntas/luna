import { generateText, type LanguageModel, tool } from "ai";

export interface AgentResult {
	answer: string;
	toolCalls: { name: string; input: unknown; result: string }[];
	usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface AgentTool {
	name: string;
	description: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	parameters: any;
	execute: (input: unknown) => Promise<string>;
}

export async function reactAgent(
	query: string,
	model: LanguageModel,
	tools: AgentTool[],
	systemPrompt?: string,
	history?: { role: "user" | "assistant"; content: string }[],
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	providerOptions?: Record<string, any>,
	maxSteps = 10,
): Promise<AgentResult> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const aiTools: Record<string, any> = {};
	for (const t of tools) {
		aiTools[t.name] = tool({
			description: t.description,
			parameters: t.parameters,
			execute: async (input: unknown) => await t.execute(input),
		});
	}

	const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
		{ role: "system", content: systemPrompt ?? "You are a helpful assistant." },
		...(history ?? []),
		{ role: "user", content: query },
	];

	const runOnce = async (forceTools: boolean, steps: number) =>
		generateText({
			model,
			messages,
			tools: aiTools,
			toolChoice: forceTools ? "required" : "auto",
			providerOptions,
			maxSteps: steps,
		});

	// PASS 1: Natural multi-step loop
	let result = await runOnce(false, Math.min(maxSteps, 3));

	// FALLBACK 1: If model completely failed to output anything, force a tool call
	if (result.toolCalls.length === 0 && !result.text?.trim()) {
		result = await runOnce(true, 1);
	}

	let answer = result.text;

	const toolCalls = result.toolCalls.map((tc, i) => ({
		name: tc.toolName,
		input: tc.args,
		result: String(result.toolResults[i]?.result ?? ""),
	}));

	// FALLBACK 2: If we have tool results but the model didn't synthesize text
	if (!answer && toolCalls.length > 0) {
		const resultsSummary = toolCalls.map((tc) => `[${tc.name}] ${tc.result}`).join("\n\n");

		const synthResult = await generateText({
			model,
			messages: [
				{
					role: "system",
					content: systemPrompt ?? "You are a helpful assistant.",
				},
				{
					role: "user",
					content: `Question: ${query}\n\nTool results:\n${resultsSummary}\n\nRespond to my original question using this info. Keep it brief (1-3 sentences). Do not mention tools, search results, or databases. Treat the info as your own memory or like you just looked it up. If there's nothing useful, say you don't know naturally. Stay in character.`,
				},
			],
			providerOptions,
			maxSteps: 1,
		});

		answer = synthResult.text;
		return {
			answer,
			toolCalls,
			usage: {
				promptTokens: (result.usage?.promptTokens ?? 0) + (synthResult.usage?.promptTokens ?? 0),
				completionTokens:
					(result.usage?.completionTokens ?? 0) + (synthResult.usage?.completionTokens ?? 0),
				totalTokens: (result.usage?.totalTokens ?? 0) + (synthResult.usage?.totalTokens ?? 0),
			},
		};
	}

	if (!answer) {
		answer = "Hmm, my brain just blue-screened on that one. Wanna talk about something else?";
	}

	return {
		answer,
		toolCalls,
		usage: {
			promptTokens: result.usage?.promptTokens ?? 0,
			completionTokens: result.usage?.completionTokens ?? 0,
			totalTokens: result.usage?.totalTokens ?? 0,
		},
	};
}
