import dedent from "dedent";

export function knowledgeExtractionPrompt(text: string): string {
	return dedent`
		You are a knowledge extraction system. Extract ALL entities and relationships from the text below.

		Rules:
		- Be thorough: extract every person, organization, project, place, concept, technology, and event mentioned.
		- Use predefined types when they fit: Person, Organization, Project, Event, Location, Concept, Technology, Document.
		- Create new descriptive types if none of the predefined ones fit.
		- Every relation must reference entities that exist in the entities list.
		- Properties should capture concrete facts (dates, roles, descriptions, URLs, etc).
		- Use UPPER_SNAKE_CASE for relation types.
		- If the text is a conversation, extract the speakers as Person entities.

		Text:
		${text}
	`;
}
