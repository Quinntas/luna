import { describe, expect, test } from "bun:test";
import { chunkText } from "../extract/chunker.ts";

describe("chunkText", () => {
	test("returns single chunk for short text", () => {
		const result = chunkText("Hello world.");
		expect(result).toEqual(["Hello world."]);
	});

	test("splits on sentence boundaries", () => {
		const text = "First sentence. Second sentence. Third sentence.";
		const result = chunkText(text, 30);
		expect(result.length).toBeGreaterThan(1);
		expect(result.join(" ")).toContain("First sentence.");
		expect(result.join(" ")).toContain("Second sentence.");
	});

	test("does not split on Dr. abbreviation", () => {
		const text = "Dr. Smith went to the hospital. He treated patients.";
		const result = chunkText(text, 30);
		expect(result[0]).toContain("Dr. Smith");
	});

	test("does not split on Mr. abbreviation", () => {
		const text = "Mr. Jones arrived on Jan. 5. He was early.";
		const result = chunkText(text, 30);
		expect(result[0]).toContain("Mr. Jones");
		expect(result[0]).toContain("Jan. 5");
	});

	test("does not split on U.S. abbreviation", () => {
		const text = "The U.S. economy grew. Markets rallied.";
		const result = chunkText(text, 30);
		expect(result[0]).toContain("U.S. economy");
	});

	test("does not split on e.g. abbreviation", () => {
		const text = "Use tools, e.g. a hammer. It works well.";
		const result = chunkText(text, 30);
		expect(result[0]).toContain("e.g. a hammer");
	});

	test("splits on exclamation marks", () => {
		const text = "Hello! World!";
		const result = chunkText(text, 10);
		expect(result.length).toBe(2);
	});

	test("splits on question marks", () => {
		const text = "Is it true? Yes it is.";
		const result = chunkText(text, 15);
		expect(result.length).toBe(2);
	});

	test("respects maxChars limit", () => {
		const text =
			"This is a long sentence that should be split. This is another long sentence that should also be split. And a third one here too.";
		const result = chunkText(text, 50);
		for (const chunk of result) {
			expect(chunk.length).toBeLessThanOrEqual(80);
		}
	});

	test("handles empty string", () => {
		const result = chunkText("");
		expect(result).toEqual([""]);
	});

	test("handles text without sentence endings", () => {
		const text = "just some text without punctuation";
		const result = chunkText(text);
		expect(result).toEqual(["just some text without punctuation"]);
	});

	test("handles text shorter than maxChars", () => {
		const text = "Short text.";
		const result = chunkText(text, 5000);
		expect(result).toEqual(["Short text."]);
	});
});
