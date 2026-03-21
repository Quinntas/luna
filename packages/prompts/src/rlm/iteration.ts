import dedent from "dedent";

export function rlmFirstTurnPrompt(query: string): string {
	return dedent`
		You have not interacted with the REPL environment or seen your context yet. Your next action should be to look through the context — don't just provide a final answer yet.

		Think step-by-step on what to do using the REPL environment (which contains the context) to answer: "${query}".

		Continue using the REPL environment, which has the \`context\` variable, and querying sub-LLMs by writing to \`\`\`repl\`\`\` tags. Your next action:
	`;
}

export function rlmIterationPrompt(query: string): string {
	return dedent`
		The history before is your previous interactions with the REPL environment. Think step-by-step on what to do using the REPL environment to answer: "${query}".

		Your next action:
	`;
}
