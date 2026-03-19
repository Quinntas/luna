import { generateText, type LanguageModel } from "ai";
import { franc } from "franc-min";

const LANGUAGE_NAMES: Record<string, string> = {
	por: "Portuguese",
	spa: "Spanish",
	fra: "French",
	deu: "German",
	ita: "Italian",
	jpn: "Japanese",
	zho: "Chinese",
	kor: "Korean",
	rus: "Russian",
	ara: "Arabic",
	nld: "Dutch",
	swe: "Swedish",
	dan: "Danish",
	nor: "Norwegian",
	fin: "Finnish",
	pol: "Polish",
	tur: "Turkish",
	hin: "Hindi",
	tha: "Thai",
	vie: "Vietnamese",
};

export function detectLanguage(text: string): string {
	return franc(text, { minLength: 10 });
}

export function languageName(iso6393: string): string {
	return LANGUAGE_NAMES[iso6393] ?? iso6393;
}

export function isEnglish(lang: string): boolean {
	return lang === "eng" || lang === "und";
}

export async function translateToEnglish(text: string, model: LanguageModel): Promise<string> {
	const { text: translated } = await generateText({
		model,
		maxRetries: 3,
		prompt: `Translate the following text to English. Rules:
- Return ONLY the translation, no explanations or notes
- Preserve all proper names, company names, dates, and technical terms exactly as they appear
- Preserve the original meaning and structure

Text to translate:
${text}`,
	});
	return translated;
}
