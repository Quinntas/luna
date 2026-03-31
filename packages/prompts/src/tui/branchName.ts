import dedent from "dedent";

export function branchNamePrompt(changes: string): string {
	return dedent`
		Generate a short git branch name (max 50 chars, kebab-case) for these changes.
		Respond ONLY with the branch name, no explanation.

		Changes:
		${changes}
	`;
}
