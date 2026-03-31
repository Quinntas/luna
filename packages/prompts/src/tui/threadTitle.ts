import dedent from "dedent";

export function threadTitlePrompt(message: string): string {
	return dedent`
		Generate a short descriptive title (max 40 chars) for this conversation.
		Respond ONLY with the title, no explanation.

		First message:
		${message}
	`;
}
