import { getModel } from "@luna/ai";
import {
	selfRagCritiquePrompt,
	selfRagRelevancePrompt,
	selfRagRetrieveDecisionPrompt,
} from "@luna/prompts";
import { generateText } from "ai";
import { searchEntities } from "../graph/queries.ts";
import type { Entity } from "../types.ts";

export interface SelfRagResult {
	answer: string;
	retrieved: boolean;
	supported: boolean;
	passages: string[];
}

export async function selfRagQuery(query: string): Promise<SelfRagResult> {
	const model = getModel();

	const { text: shouldRetrieve } = await generateText({
		model,
		prompt: selfRagRetrieveDecisionPrompt(query),
	});

	if (shouldRetrieve.trim().toLowerCase() !== "yes") {
		const { text: answer } = await generateText({
			model,
			prompt: query,
		});
		return { answer, retrieved: false, supported: true, passages: [] };
	}

	const entities = await searchEntities(query, { limit: 5 });
	const passages = entities.map(formatEntity);

	const relevantPassages: string[] = [];
	for (const passage of passages) {
		const { text: score } = await generateText({
			model,
			prompt: selfRagRelevancePrompt(query, passage),
		});
		const numScore = Number.parseFloat(score.trim());
		if (!Number.isNaN(numScore) && numScore >= 0.5) {
			relevantPassages.push(passage);
		}
	}

	const context =
		relevantPassages.length > 0
			? `Context:\n${relevantPassages.join("\n\n")}\n\nQuestion: ${query}`
			: query;

	const { text: answer } = await generateText({
		model,
		prompt: context,
	});

	const { text: critique } = await generateText({
		model,
		prompt: selfRagCritiquePrompt(query, answer, relevantPassages.join("\n\n")),
	});

	const supported = critique.trim().toLowerCase().startsWith("supported");

	return {
		answer,
		retrieved: true,
		supported,
		passages: relevantPassages,
	};
}

function formatEntity(entity: Entity): string {
	const props = Object.entries(entity.properties)
		.map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
		.join(", ");
	return `${entity.type}: ${entity.name}${props ? ` (${props})` : ""}`;
}
