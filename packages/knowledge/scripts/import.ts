import { closeDriver } from "../src/graph/client.ts";
import { upsertEntities, upsertRelations } from "../src/graph/upsert.ts";

async function main() {
	const inputPath = process.argv[2];
	if (!inputPath) {
		console.error("Usage: bun run import.ts <path-to-export.json>");
		process.exit(1);
	}

	const file = Bun.file(inputPath);
	if (!(await file.exists())) {
		console.error(`File not found: ${inputPath}`);
		process.exit(1);
	}

	const data = await file.json();
	const { entities, relations } = data as {
		entities: {
			name: string;
			type: string;
			aliases: string[];
			properties: Record<string, unknown>;
			confidence: number;
			sources: unknown[];
		}[];
		relations: {
			sourceId: string;
			targetId: string;
			type: string;
			properties: Record<string, unknown>;
			confidence: number;
			sources: unknown[];
		}[];
	};

	console.log(`Importing ${entities.length} entities...`);
	const entityResults = await upsertEntities(
		entities.map((e) => ({
			name: e.name,
			type: e.type,
			aliases: e.aliases,
			properties: e.properties,
			confidence: e.confidence,
			sources: e.sources as never[],
		})),
	);
	console.log(`  ✅ ${entityResults.length} entities upserted`);

	console.log(`Importing ${relations.length} relations...`);
	const relResults = await upsertRelations(
		relations.map((r) => ({
			sourceId: r.sourceId,
			targetId: r.targetId,
			type: r.type,
			properties: r.properties,
			confidence: r.confidence,
			sources: r.sources as never[],
		})),
	);
	console.log(`  ✅ ${relResults.length} relations upserted`);

	await closeDriver();
}

main().catch((err) => {
	console.error("Import failed:", err);
	process.exit(1);
});
