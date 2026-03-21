import dedent from "dedent";

export function reflexionCritiquePrompt(query: string, attempt: string, feedback: string): string {
	return dedent`
		You attempted to solve a task but it failed. Analyze why and provide a concise reflection.

		Task: ${query}
		Your attempt: ${attempt}
		Feedback/Error: ${feedback}

		In 1-3 sentences, explain what went wrong and what you should do differently next time.
	`;
}
