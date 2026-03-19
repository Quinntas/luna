const ABBREVIATIONS = new Set([
	"dr",
	"mr",
	"mrs",
	"ms",
	"prof",
	"sr",
	"jr",
	"st",
	"ave",
	"blvd",
	"dept",
	"est",
	"govt",
	"inc",
	"ltd",
	"vs",
	"etc",
	"approx",
	"dept",
	"div",
	"ed",
	"fig",
	"gen",
	"govt",
	"hon",
	"illus",
	"misc",
	"natl",
	"no",
	"orig",
	"pop",
	"ref",
	"rev",
	"ser",
	"tech",
	"temp",
	"vol",
	"jan",
	"feb",
	"mar",
	"apr",
	"jun",
	"jul",
	"aug",
	"sep",
	"oct",
	"nov",
	"dec",
	"u.s",
	"u.k",
	"e.g",
	"i.e",
	"a.m",
	"p.m",
]);

export function chunkText(text: string, maxChars = 2000): string[] {
	if (text.length <= maxChars) return [text];

	// Split on sentence-ending punctuation, but not after abbreviations
	const rawSentences: string[] = [];
	let current = "";

	for (let i = 0; i < text.length; i++) {
		current += text[i];

		if (text[i] === "." || text[i] === "!" || text[i] === "?") {
			// Check if this period is part of an abbreviation
			if (text[i] === ".") {
				const beforePeriod = current.slice(0, -1).trim().toLowerCase();
				const lastWord = beforePeriod.split(/\s+/).pop() ?? "";
				if (ABBREVIATIONS.has(lastWord)) {
					continue; // Not a sentence end
				}
			}

			rawSentences.push(current);
			current = "";
		}
	}

	if (current.trim().length > 0) {
		rawSentences.push(current);
	}

	const sentences = rawSentences.length > 0 ? rawSentences : [text];
	const chunks: string[] = [];
	let chunk = "";

	for (const sentence of sentences) {
		if (chunk.length + sentence.length > maxChars && chunk.length > 0) {
			chunks.push(chunk.trim());
			chunk = sentence;
		} else {
			chunk += sentence;
		}
	}

	if (chunk.trim().length > 0) {
		chunks.push(chunk.trim());
	}

	return chunks.length > 0 ? chunks : [text];
}
