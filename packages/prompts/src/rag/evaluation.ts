import dedent from "dedent";

export function selfRagRetrieveDecisionPrompt(query: string): string {
	return dedent`
		Should I retrieve external information to answer this query?
		Query: ${query}
		Respond with only "yes" or "no".
	`;
}

export function selfRagRelevancePrompt(query: string, passage: string): string {
	return dedent`
		Rate the relevance of this passage to the query on a scale of 0-1.
		Query: ${query}
		Passage: ${passage}
		Respond with only a number between 0 and 1.
	`;
}

export function selfRagCritiquePrompt(query: string, answer: string, passages: string): string {
	return dedent`
		Critique this answer. Is it supported by the passages? Does it directly answer the query?

		Query: ${query}
		Answer: ${answer}
		Passages:
		${passages}

		Respond with "supported" if the answer is correct and supported, or "unsupported: [reason]" if not.
	`;
}

export function cragRelevancePrompt(query: string, document: string): string {
	return dedent`
		Rate how relevant this document is for answering the query. Consider whether it contains useful information, partial information, or is irrelevant.

		Query: ${query}
		Document: ${document}

		Respond with one of: "correct", "incorrect", "ambiguous"
	`;
}

export function cragQueryRewritePrompt(query: string): string {
	return dedent`
		The original query couldn't be answered from the available documents. Rewrite it to be more specific or to cover a different angle that might yield better results.

		Original query: ${query}

		Respond with only the rewritten query.
	`;
}
