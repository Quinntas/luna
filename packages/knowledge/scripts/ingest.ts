import { getModel, type LanguageModel } from "@luna/ai";
import { chunkText } from "../src/extract/chunker.ts";
import { extractFromText } from "../src/extract/extractor.ts";
import {
	detectLanguage,
	isEnglish,
	languageName,
	translateToEnglish,
} from "../src/extract/translate.ts";
import { closeDriver, getDriver } from "../src/graph/client.ts";
import { ingestDirectory, ingestFile, ingestText } from "./ingest-lib.ts";

async function readStdin(): Promise<string> {
	const chunks: Uint8Array[] = [];
	for await (const chunk of Bun.stdin.stream()) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks).toString("utf-8");
}

function printResult(result: {
	entitiesCreated: number;
	entitiesMerged: number;
	relationsCreated: number;
	conflicts: { id: string }[];
	chunksProcessed: number;
	durationMs: number;
}) {
	console.log(`\n${"─".repeat(50)}`);
	console.log("✅ Ingestion complete");
	console.log(`   Entities created: ${result.entitiesCreated}`);
	console.log(`   Entities merged:  ${result.entitiesMerged}`);
	console.log(`   Relations created: ${result.relationsCreated}`);
	console.log(`   Chunks processed: ${result.chunksProcessed}`);
	console.log(`   Duration:         ${result.durationMs}ms`);
	if (result.conflicts.length > 0) {
		console.log(`   ⚠️  Conflicts: ${result.conflicts.length} (run: bun run knowledge:resolve)`);
	}
	console.log("─".repeat(50));
}

async function dryRun(text: string, model: LanguageModel) {
	const lang = detectLanguage(text);
	let processedText = text;
	if (!isEnglish(lang)) {
		console.log(`  Detected ${languageName(lang)}, translating to English...`);
		processedText = await translateToEnglish(text, model);
	}

	const chunks = chunkText(processedText);
	console.log(`Would process ${chunks.length} chunk(s):\n`);

	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		if (!chunk) continue;
		console.log(`--- Chunk ${i + 1} (${chunk.length} chars) ---`);
		const extracted = await extractFromText(chunk, model);
		console.log(`Entities: ${extracted.entities.map((e) => `${e.type}:${e.name}`).join(", ")}`);
		console.log(
			`Relations: ${extracted.relations.map((r) => `${r.source} -[${r.type}]-> ${r.target}`).join(", ")}`,
		);
		console.log(`Summary: ${extracted.summary}\n`);
	}
}

async function main() {
	const model = getModel();

	const args = process.argv.slice(2);
	const dryRunFlag = args.includes("--dry-run");
	const positionalArgs = args.filter((a) => !a.startsWith("--"));
	const arg = positionalArgs[0];

	if (!dryRunFlag) {
		const driver = getDriver();
		try {
			await driver.verifyConnectivity();
		} catch {
			console.error("❌ Cannot connect to Neo4j. Is it running? Try: bun run knowledge:setup");
			process.exit(1);
		}
	}

	if (!arg || arg === "-") {
		console.log("Paste your text (Ctrl+D when done):");
		const text = await readStdin();
		if (!text.trim()) {
			console.error("No input provided.");
			process.exit(1);
		}

		if (dryRunFlag) {
			await dryRun(text, model);
		} else {
			const result = await ingestText(text, model);
			printResult(result);
		}
	} else {
		const { stat } = await import("node:fs/promises");
		const stats = await stat(arg);

		if (stats.isDirectory()) {
			if (dryRunFlag) {
				const { readdir } = await import("node:fs/promises");
				const entries = await readdir(arg, { withFileTypes: true });
				for (const entry of entries) {
					if (entry.isDirectory() || !entry.name.match(/\.(txt|md|json|csv)$/i)) continue;
					console.log(`\n📄 ${entry.name}`);
					const file = Bun.file(`${arg}/${entry.name}`);
					await dryRun(await file.text(), model);
				}
			} else {
				const result = await ingestDirectory(arg, model);
				printResult(result);
			}
		} else {
			if (dryRunFlag) {
				const file = Bun.file(arg);
				await dryRun(await file.text(), model);
			} else {
				const result = await ingestFile(arg, model);
				printResult(result);
			}
		}
	}

	await closeDriver();
}

main().catch((err) => {
	console.error("❌ Ingestion failed:", err);
	process.exit(1);
});
