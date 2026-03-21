import dedent from "dedent";

export function visionExtractionPrompt(): string {
	return dedent`
		Extract all text, entities, and relationships from this image or document page.
		Describe any charts, diagrams, or visual elements.
		Identify key information: names, dates, numbers, organizations, locations.
	`;
}

export function pdfPageAnalysisPrompt(pageText: string): string {
	return dedent`
		Analyze this page of a document. Extract:
		- Key entities (people, organizations, locations)
		- Important facts and figures
		- Document structure (headers, sections, tables)
		- Relationships between entities

		Page content:
		${pageText}
	`;
}
