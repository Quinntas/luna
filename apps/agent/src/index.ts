import { getModel } from "@luna/ai";
import { allBuiltInTools, registerTools } from "@luna/tools";
import { agentTurn } from "./agent.ts";
import type { AgentConfig } from "./types.ts";

async function main() {
	const model = getModel();
	registerTools(allBuiltInTools);
	const config: AgentConfig = { model, maxSteps: 10, user: "Caio" };

	const arg = process.argv[2];

	if (arg && arg !== "--interactive") {
		const input = process.argv.slice(2).join(" ");
		const result = await agentTurn(input, config);
		console.log(`\n${result.moodStatus}\n`);
		console.log(result.answer);
		if (result.memoriesExtracted > 0) {
			console.log(`[remembered ${result.memoriesExtracted} fact(s)]`);
		}
		console.log(
			`[tokens: ${result.usage.promptTokens} in / ${result.usage.completionTokens} out / ${result.usage.totalTokens} total]`,
		);
		return;
	}

	const readline = await import("node:readline");
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

	console.log("Luna Agent — Type your message (Ctrl+C to exit)\n");

	config.history = [];

	const prompt = (): void => {
		rl.question("You: ", async (line) => {
			if (!line.trim()) {
				prompt();
				return;
			}
			try {
				const result = await agentTurn(line, config);
				console.log(`\n${result.moodStatus}\n`);
				console.log(result.answer);
				if (result.memoriesExtracted > 0) {
					console.log(`[remembered ${result.memoriesExtracted} fact(s)]`);
				}
				console.log(
					`[tokens: ${result.usage.promptTokens} in / ${result.usage.completionTokens} out / ${result.usage.totalTokens} total]`,
				);
				console.log("");
			} catch (err) {
				console.error(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
			}
			prompt();
		});
	};

	prompt();
}

main().catch((err) => {
	console.error("Agent failed:", err);
	process.exit(1);
});
