import { getModel } from "@luna/ai";
import { cragQueryRewritePrompt, cragRelevancePrompt } from "@luna/prompts";
import { generateText } from "ai";
import { searchEntities } from "../graph/queries.ts";
import type { Entity } from "../types.ts";

export interface CragResult {
	answer: string;
	strategy: "correct" | "incorrect" | "ambiguous";
	rewrittenQuery?: string;
	passages: string[];
}

export async function cragQuery(query: string): Promise<CragResult> {
	const model = getModel();

	const entities = await searchEntities(query, { limit: 5 });

	if (entities.length === 0) {
		const { text: answer } = await generateText({ model, prompt: query });
		return { answer, strategy: "incorrect", passages: [] };
	}

	const passages = entities.map(formatEntity);
	const relevanceScores: string[] = [];

	for (const passage of passages) {
		const { text: score } = await generateText({
			model,
			prompt: cragRelevancePrompt(query, passage),
		});
		relevanceScores.push(score.trim().toLowerCase());
	}

	const correctCount = relevanceScores.filter((s) => s === "correct").length;
	const ambiguousCount = relevanceScores.filter((s) => s === "ambiguous").length;

	let strategy: CragResult["strategy"];
	let rewrittenQuery: string | undefined;

	if (correctCount >= 2) {
		strategy = "correct";
	} else if (ambiguousCount > 0) {
		strategy = "ambiguous";
	} else {
		strategy = "incorrect";
		const { text: rewritten } = await generateText({
			model,
			prompt: cragQueryRewritePrompt(query),
		});
		rewrittenQuery = rewritten.trim();
	}

	const relevantPassages = passages.filter((_, i) => relevanceScores[i] === "correct");

	const context =
		relevantPassages.length > 0
			? `Context:\n${relevantPassages.join("\n\n")}\n\nQuestion: ${query}`
			: query;

	const { text: answer } = await generateText({ model, prompt: context });

	return { answer, strategy, rewrittenQuery, passages };
}

function formatEntity(entity: Entity): string {
	const props = Object.entries(entity.properties)
		.map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
		.join(", ");
	return `${entity.type}: ${entity.name}${props ? ` (${props})` : ""}`;
}
