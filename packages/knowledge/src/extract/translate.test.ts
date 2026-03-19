import { describe, expect, test } from "bun:test";
import { detectLanguage, isEnglish, languageName } from "../extract/translate.ts";

describe("detectLanguage", () => {
	test("detects English", () => {
		const lang = detectLanguage(
			"This is a longer English text that should be detected correctly as English language.",
		);
		expect(lang).toBe("eng");
	});

	test("detects Portuguese", () => {
		const lang = detectLanguage(
			"Esta é uma frase em português que deve ser detectada corretamente como língua portuguesa.",
		);
		expect(["por", "spa"]).toContain(lang);
	});

	test("detects Spanish", () => {
		const lang = detectLanguage(
			"Esta es una frase en español que debería ser detectada correctamente como idioma español.",
		);
		expect(["spa", "por"]).toContain(lang);
	});

	test("returns und for very short text", () => {
		const lang = detectLanguage("Hi");
		expect(lang).toBe("und");
	});
});

describe("isEnglish", () => {
	test("returns true for eng", () => {
		expect(isEnglish("eng")).toBe(true);
	});

	test("returns true for und", () => {
		expect(isEnglish("und")).toBe(true);
	});

	test("returns false for por", () => {
		expect(isEnglish("por")).toBe(false);
	});

	test("returns false for spa", () => {
		expect(isEnglish("spa")).toBe(false);
	});
});

describe("languageName", () => {
	test("returns Portuguese for por", () => {
		expect(languageName("por")).toBe("Portuguese");
	});

	test("returns Spanish for spa", () => {
		expect(languageName("spa")).toBe("Spanish");
	});

	test("returns French for fra", () => {
		expect(languageName("fra")).toBe("French");
	});

	test("returns unknown code as-is", () => {
		expect(languageName("xyz")).toBe("xyz");
	});
});
