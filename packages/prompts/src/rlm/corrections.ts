import dedent from "dedent";

export function rlmNoCodeCorrection(response: string): string {
	return dedent`
		You responded without code. Use the REPL to explore the context. Your response:
		${response}
	`;
}
