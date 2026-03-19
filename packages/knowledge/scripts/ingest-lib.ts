import { canonicalizeEntities } from "../src/canonicalize/resolver.ts";
import { chunkText } from "../src/extract/chunker.ts";
import { extractFromText } from "../src/extract/extractor.ts";
import {
	createEntityId,
	findEntityById,
	upsertEntity,
	upsertRelation,
} from "../src/graph/upsert.ts";
import type { Conflict, Entity, IngestionResult, Provenance } from "../src/types.ts";
import { assignConfidence } from "../src/validate/confidence.ts";
import { detectConflicts, propertyConflictsToConflicts } from "../src/validate/conflicts.ts";
import { createProvenance } from "../src/validate/provenance.ts";

async function processChunk(
	text: string,
	sourceType: Provenance["sourceType"],
	sourceRef: string,
	chunkIndex: number,
	conflicts: Conflict[],
) {
	const provenance = createProvenance(sourceType, sourceRef, text, chunkIndex);
	const extracted = await extractFromText(text);

	// Resolve entities against the graph
	const existingEntities: Entity[] = [];
	for (const ext of extracted.entities) {
		const id = createEntityId(ext.name, ext.type);
		const existing = await findEntityById(id);
		if (existing) existingEntities.push(existing);
	}

	const canonicalized = canonicalizeEntities(extracted.entities, existingEntities, provenance);

	let entitiesCreated = 0;
	let entitiesMerged = 0;
	const entityNameToId = new Map<string, string>();

	for (const item of canonicalized) {
		const confidence = assignConfidence(item.entity.sources);

		if (item.action === "merge" && item.mergedIntoId) {
			const existing = await findEntityById(item.mergedIntoId);
			if (existing) {
				const propConflicts = detectConflicts(existing, item.entity.properties, provenance);
				if (propConflicts.length > 0) {
					conflicts.push(...propertyConflictsToConflicts(propConflicts));
				}
			}
			const id = await upsertEntity({ ...item.entity, confidence });
			entityNameToId.set(item.entity.name, id);
			entitiesMerged++;
		} else {
			const id = await upsertEntity({ ...item.entity, confidence });
			entityNameToId.set(item.entity.name, id);
			entitiesCreated++;
		}
	}

	let relationsCreated = 0;
	for (const rel of extracted.relations) {
		const sourceId = entityNameToId.get(rel.source);
		const targetId = entityNameToId.get(rel.target);
		if (!sourceId || !targetId) continue;

		await upsertRelation({
			sourceId,
			targetId,
			type: rel.type,
			properties: rel.properties,
			confidence: assignConfidence([provenance]),
			sources: [provenance],
		});
		relationsCreated++;
	}

	return { entitiesCreated, entitiesMerged, relationsCreated };
}

export async function ingestText(
	text: string,
	sourceRef = "paste",
	sourceType: Provenance["sourceType"] = "paste",
): Promise<IngestionResult> {
	const chunks = chunkText(text);
	const conflicts: Conflict[] = [];
	let entitiesCreated = 0;
	let entitiesMerged = 0;
	let relationsCreated = 0;

	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		if (!chunk) continue;
		console.log(`  Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)...`);

		const result = await processChunk(chunk, sourceType, sourceRef, i, conflicts);

		entitiesCreated += result.entitiesCreated;
		entitiesMerged += result.entitiesMerged;
		relationsCreated += result.relationsCreated;
	}

	return {
		entitiesCreated,
		entitiesMerged,
		relationsCreated,
		conflicts,
		chunksProcessed: chunks.length,
	};
}

export async function ingestFile(filePath: string): Promise<IngestionResult> {
	const file = Bun.file(filePath);
	const text = await file.text();
	const fileName = filePath.split("/").pop() ?? filePath;
	return ingestText(text, fileName, "file");
}

export async function ingestDirectory(dirPath: string): Promise<IngestionResult> {
	const { readdir } = await import("node:fs/promises");
	const entries = await readdir(dirPath, { withFileTypes: true });

	const total: IngestionResult = {
		entitiesCreated: 0,
		entitiesMerged: 0,
		relationsCreated: 0,
		conflicts: [],
		chunksProcessed: 0,
	};

	for (const entry of entries) {
		if (entry.isDirectory()) continue;
		if (!entry.name.match(/\.(txt|md|json|csv)$/i)) continue;

		const fullPath = `${dirPath}/${entry.name}`;
		console.log(`\n📄 Ingesting: ${entry.name}`);

		try {
			const result = await ingestFile(fullPath);
			total.entitiesCreated += result.entitiesCreated;
			total.entitiesMerged += result.entitiesMerged;
			total.relationsCreated += result.relationsCreated;
			total.conflicts.push(...result.conflicts);
			total.chunksProcessed += result.chunksProcessed;
		} catch (err) {
			console.error(`  ⚠️  Failed to ingest ${entry.name}:`, err);
		}
	}

	return total;
}
