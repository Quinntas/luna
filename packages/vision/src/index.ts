import { visionExtractionPrompt } from "@luna/prompts";
import { generateText, type LanguageModel } from "ai";

export interface VisionResult {
	description: string;
	entities: { name: string; type: string }[];
	text: string;
}

export async function analyzeImage(imageUrl: string, model: LanguageModel): Promise<VisionResult> {
	const { text } = await generateText({
		model,
		messages: [
			{
				role: "user",
				content: [
					{ type: "text", text: visionExtractionPrompt() },
					{ type: "image", image: imageUrl },
				],
			},
		],
	});

	return {
		description: text,
		entities: [],
		text,
	};
}

export async function analyzePdfPage(
	pageText: string,
	model: LanguageModel,
): Promise<VisionResult> {
	const { pdfPageAnalysisPrompt } = await import("@luna/prompts");

	const { text } = await generateText({
		model,
		prompt: pdfPageAnalysisPrompt(pageText),
	});

	return {
		description: text,
		entities: [],
		text,
	};
}
