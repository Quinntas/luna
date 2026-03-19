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
}) {
	console.log(`\n${"─".repeat(50)}`);
	console.log("✅ Ingestion complete");
	console.log(`   Entities created: ${result.entitiesCreated}`);
	console.log(`   Entities merged:  ${result.entitiesMerged}`);
	console.log(`   Relations created: ${result.relationsCreated}`);
	console.log(`   Chunks processed: ${result.chunksProcessed}`);
	if (result.conflicts.length > 0) {
		console.log(`   ⚠️  Conflicts: ${result.conflicts.length} (run: bun run knowledge:resolve)`);
	}
	console.log("─".repeat(50));
}

async function main() {
	const arg = process.argv[2];

	// Verify connection
	const driver = getDriver();
	try {
		await driver.verifyConnectivity();
	} catch {
		console.error("❌ Cannot connect to Neo4j. Is it running? Try: bun run knowledge:setup");
		process.exit(1);
	}

	if (!arg || arg === "-") {
		// Read from stdin (piped or interactive paste)
		console.log("Paste your text (Ctrl+D when done):");
		const text = await readStdin();
		if (!text.trim()) {
			console.error("No input provided.");
			process.exit(1);
		}
		const result = await ingestText(text);
		printResult(result);
	} else {
		const { stat } = await import("node:fs/promises");
		const stats = await stat(arg);

		if (stats.isDirectory()) {
			const result = await ingestDirectory(arg);
			printResult(result);
		} else {
			const result = await ingestFile(arg);
			printResult(result);
		}
	}

	await closeDriver();
}

main().catch((err) => {
	console.error("❌ Ingestion failed:", err);
	process.exit(1);
});
