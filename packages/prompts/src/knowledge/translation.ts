import dedent from "dedent";

export function translationPrompt(text: string): string {
	return dedent`
		Translate the following text to English. Rules:
		- Return ONLY the translation, no explanations or notes
		- Preserve all proper names, company names, dates, and technical terms exactly as they appear
		- Preserve the original meaning and structure

		Text to translate:
		${text}
	`;
}
