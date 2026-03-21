import { translationPrompt } from "@luna/prompts";
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
		prompt: translationPrompt(text),
	});
	return translated;
}
