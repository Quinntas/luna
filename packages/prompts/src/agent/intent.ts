import dedent from "dedent";

export function intentClassificationPrompt(message: string): string {
	return dedent`
		Classify the sentiment and intent of this user message.

		Message: "${message}"

		Rules:
		- praise: user compliments or approves of something
		- criticism: user corrects or disapproves
		- gratitude: user thanks
		- frustration: user expresses annoyance or impatience
		- humor: user is joking or being funny
		- question: user is asking for information
		- request: user is asking for an action
		- statement: neutral informational statement
	`;
}
