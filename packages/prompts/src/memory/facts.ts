import dedent from "dedent";

export function factExtractionPrompt(messages: string): string {
	return dedent`
		Extract all salient facts from this conversation. A fact is a concrete, verifiable piece of information about the user — their preferences, experiences, relationships, plans, opinions, or knowledge.

		Rules:
		- Extract facts as complete, standalone sentences
		- Each fact must be self-contained (understandable without the conversation)
		- Include the user's name/identity if mentioned
		- Capture preferences (likes, dislikes, style choices)
		- Capture experiences (what they've done, where they've been)
		- Capture plans (what they want to do)
		- Capture relationships (who they know, work with)
		- Do NOT extract generic advice or assistant responses
		- Do NOT extract facts from trivial exchanges including: greetings ("hey", "hello", "what's up"), small talk ("nothing much", "just chilling"), insults ("fuck you"), jokes, or filler ("ok", "cool", "nice", "lol")
		- Only extract facts when the user shares meaningful personal information or asks a substantive question
		- If the conversation contains no salient facts, return an empty array []
		- Rate each fact's importance: high (critical personal info), medium (useful context), low (trivial detail)

		Conversation:
		${messages}

		Respond with a JSON array of objects with "fact", "importance" (high/medium/low), and "tags" fields.
	`;
}

export function memoryRelevancePrompt(query: string, memories: string): string {
	return dedent`
		Given the following query and stored memories, determine which memories are relevant to answer the query.

		Query: ${query}

		Memories:
		${memories}

		Respond with a JSON array of memory IDs that are relevant, ordered by relevance (most relevant first).
	`;
}
