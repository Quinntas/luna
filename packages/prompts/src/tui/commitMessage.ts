import dedent from "dedent";

export function commitMessagePrompt(changes: string): string {
	return dedent`
		Generate a conventional commit message (max 72 chars) for these changes.
		Format: type: description
		Respond ONLY with the message, no explanation.

		Changes:
		${changes}
	`;
}
