import dedent from "dedent";

export function rlmExecutionFeedback(code: string, output: string, variables: string[]): string {
	return dedent`
		Code executed:
		\`\`\`javascript
		${code}
		\`\`\`

		REPL output:
		${output}

		REPL variables: ${variables.join(", ")}
	`;
}
