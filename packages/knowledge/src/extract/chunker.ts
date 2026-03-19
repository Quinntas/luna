export function chunkText(text: string, maxChars = 2000): string[] {
	if (text.length <= maxChars) return [text];

	const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
	const chunks: string[] = [];
	let current = "";

	for (const sentence of sentences) {
		if (current.length + sentence.length > maxChars && current.length > 0) {
			chunks.push(current.trim());
			current = sentence;
		} else {
			current += sentence;
		}
	}

	if (current.trim().length > 0) {
		chunks.push(current.trim());
	}

	return chunks.length > 0 ? chunks : [text];
}
