import { describe, expect, test } from "bun:test";
import {
	agentSystemPrompt,
	cragQueryRewritePrompt,
	cragRelevancePrompt,
	factExtractionPrompt,
	knowledgeExtractionPrompt,
	memoryRelevancePrompt,
	pdfPageAnalysisPrompt,
	reflexionCritiquePrompt,
	rlmExecutionFeedback,
	rlmFirstTurnPrompt,
	rlmIterationPrompt,
	rlmMaxIterationsFallback,
	rlmNoCodeCorrection,
	rlmSystemPrompt,
	selfRagCritiquePrompt,
	selfRagRelevancePrompt,
	selfRagRetrieveDecisionPrompt,
	translationPrompt,
	visionExtractionPrompt,
} from "./index.ts";

describe("agent prompts", () => {
	test("agentSystemPrompt contains tool format and cutoff date", () => {
		const prompt = agentSystemPrompt(["calculator", "search"], "2024-12-31", "2025-03-21");
		expect(prompt).toContain("tools");
		expect(prompt).toContain("calculator");
		expect(prompt).toContain("search");
		expect(prompt).toContain("knowledge cutoff");
		expect(prompt).toContain("2024-12-31");
		expect(prompt).toContain("2025-03-21");
		expect(prompt).toContain("CALL A TOOL");
	});

	test("reflexionCritiquePrompt contains all inputs", () => {
		const prompt = reflexionCritiquePrompt("task", "attempt", "feedback");
		expect(prompt).toContain("task");
		expect(prompt).toContain("attempt");
		expect(prompt).toContain("feedback");
	});
});

describe("memory prompts", () => {
	test("factExtractionPrompt contains conversation", () => {
		const prompt = factExtractionPrompt("user: Hello\nassistant: Hi");
		expect(prompt).toContain("user: Hello");
		expect(prompt).toContain("Extract all salient facts");
		expect(prompt).toContain("importance");
	});

	test("memoryRelevancePrompt contains query and memories", () => {
		const prompt = memoryRelevancePrompt("Where do I work?", "mem1: Alice at Google");
		expect(prompt).toContain("Where do I work?");
		expect(prompt).toContain("mem1: Alice at Google");
	});
});

describe("vision prompts", () => {
	test("visionExtractionPrompt is non-empty", () => {
		const prompt = visionExtractionPrompt();
		expect(prompt.length).toBeGreaterThan(0);
		expect(prompt).toContain("Extract");
	});

	test("pdfPageAnalysisPrompt contains page text", () => {
		const prompt = pdfPageAnalysisPrompt("Page content here");
		expect(prompt).toContain("Page content here");
		expect(prompt).toContain("Key entities");
	});
});

describe("knowledge prompts", () => {
	test("knowledgeExtractionPrompt contains text", () => {
		const prompt = knowledgeExtractionPrompt("Alice works at Google.");
		expect(prompt).toContain("Alice works at Google.");
		expect(prompt).toContain("knowledge extraction");
		expect(prompt).toContain("UPPER_SNAKE_CASE");
	});

	test("translationPrompt contains text", () => {
		const prompt = translationPrompt("Olá mundo");
		expect(prompt).toContain("Olá mundo");
		expect(prompt).toContain("Translate");
		expect(prompt).toContain("Preserve all proper names");
	});
});

describe("rag prompts", () => {
	test("selfRagRetrieveDecisionPrompt contains query", () => {
		const prompt = selfRagRetrieveDecisionPrompt("What is the capital?");
		expect(prompt).toContain("What is the capital?");
		expect(prompt).toContain("retrieve");
	});

	test("selfRagRelevancePrompt contains query and passage", () => {
		const prompt = selfRagRelevancePrompt("query", "passage text");
		expect(prompt).toContain("query");
		expect(prompt).toContain("passage text");
	});

	test("selfRagCritiquePrompt contains all inputs", () => {
		const prompt = selfRagCritiquePrompt("q", "a", "p1\np2");
		expect(prompt).toContain("q");
		expect(prompt).toContain("a");
		expect(prompt).toContain("p1");
	});

	test("cragRelevancePrompt contains query and document", () => {
		const prompt = cragRelevancePrompt("q", "doc");
		expect(prompt).toContain("q");
		expect(prompt).toContain("doc");
		expect(prompt).toContain("correct");
	});

	test("cragQueryRewritePrompt contains query", () => {
		const prompt = cragQueryRewritePrompt("original query");
		expect(prompt).toContain("original query");
		expect(prompt).toContain("Rewrite");
	});
});

describe("rlm prompts", () => {
	test("rlmSystemPrompt contains query and REPL instructions", () => {
		const prompt = rlmSystemPrompt("What is X?");
		expect(prompt).toContain("What is X?");
		expect(prompt).toContain("REPL");
		expect(prompt).toContain("llm_query");
		expect(prompt).toContain("FINAL");
		expect(prompt).toContain("FINAL_VAR");
	});

	test("rlmNoCodeCorrection contains response", () => {
		const prompt = rlmNoCodeCorrection("I will analyze.");
		expect(prompt).toContain("I will analyze.");
		expect(prompt).toContain("without code");
	});

	test("rlmMaxIterationsFallback is non-empty", () => {
		const prompt = rlmMaxIterationsFallback();
		expect(prompt.length).toBeGreaterThan(0);
		expect(prompt).toContain("final answer");
	});

	test("rlmExecutionFeedback contains code and output", () => {
		const prompt = rlmExecutionFeedback("const x = 1", "1", ["x"]);
		expect(prompt).toContain("const x = 1");
		expect(prompt).toContain("1");
		expect(prompt).toContain("x");
	});

	test("rlmFirstTurnPrompt contains query", () => {
		const prompt = rlmFirstTurnPrompt("my query");
		expect(prompt).toContain("my query");
		expect(prompt).toContain("not interacted");
	});

	test("rlmIterationPrompt contains query", () => {
		const prompt = rlmIterationPrompt("my query");
		expect(prompt).toContain("my query");
		expect(prompt).toContain("previous interactions");
	});
});
