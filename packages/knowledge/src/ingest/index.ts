import type { LanguageModel } from "ai";
import { canonicalizeEntities, normalizeRelations } from "../canonicalize/resolver.ts";
import { chunkText } from "../extract/chunker.ts";
import { extractFromText } from "../extract/extractor.ts";
import {
	detectLanguage,
	isEnglish,
	languageName,
	translateToEnglish,
} from "../extract/translate.ts";
import {
	createEntityId,
	findEntitiesByIds,
	upsertEntities,
	upsertRelations,
} from "../graph/upsert.ts";
import type { Conflict, IngestionResult, Provenance } from "../types.ts";
import { assignConfidence } from "../validate/confidence.ts";
import { detectConflicts, propertyConflictsToConflicts } from "../validate/conflicts.ts";
import { createProvenance } from "../validate/provenance.ts";

async function processChunk(
	text: string,
	model: LanguageModel,
	sourceType: Provenance["sourceType"],
	sourceRef: string,
	chunkIndex: number,
	conflicts: Conflict[],
) {
	const provenance = createProvenance(sourceType, sourceRef, text, chunkIndex);
	const extracted = await extractFromText(text, model);

	// Normalize relation types
	extracted.relations = normalizeRelations(extracted.relations);

	// Batch lookup existing entities
	const entityIds = extracted.entities.map((ext) => createEntityId(ext.name, ext.type));
	const existingMap = await findEntitiesByIds(entityIds);
	const existingArray = Array.from(existingMap.values());

	const canonicalized = canonicalizeEntities(extracted.entities, existingArray, provenance);

	// Prepare all entities for batch upsert
	const toUpsert = canonicalized.map((item) => {
		if (item.action === "merge" && item.mergedIntoId) {
			const existing = existingMap.get(item.mergedIntoId);
			if (existing) {
				const propConflicts = detectConflicts(existing, item.entity.properties, provenance);
				if (propConflicts.length > 0) {
					conflicts.push(...propertyConflictsToConflicts(propConflicts));
				}
			}
		}
		return { ...item.entity, confidence: assignConfidence(item.entity.sources) };
	});

	// Batch upsert entities
	const entityIdsResult = await upsertEntities(toUpsert);

	const entitiesCreated = canonicalized.filter((c) => c.action === "create").length;
	const entitiesMerged = canonicalized.filter((c) => c.action === "merge").length;

	// Map entity names to their IDs
	const entityNameToId = new Map<string, string>();
	for (let i = 0; i < canonicalized.length; i++) {
		const item = canonicalized[i];
		const id = entityIdsResult[i];
		if (!item || !id) continue;
		entityNameToId.set(item.entity.name, id);
	}

	// Batch upsert relations
	const relationsToUpsert = extracted.relations
		.map((rel) => {
			const sourceId = entityNameToId.get(rel.source);
			const targetId = entityNameToId.get(rel.target);
			if (!sourceId || !targetId) return null;
			return {
				sourceId,
				targetId,
				type: rel.type,
				properties: rel.properties,
				confidence: assignConfidence([provenance]),
				sources: [provenance],
			};
		})
		.filter((r): r is NonNullable<typeof r> => r !== null);

	await upsertRelations(relationsToUpsert);

	return {
		entitiesCreated,
		entitiesMerged,
		relationsCreated: relationsToUpsert.length,
		entityNames: canonicalized.map((c) => c.entity.name),
	};
}

async function processChunksParallel(
	chunks: string[],
	model: LanguageModel,
	sourceType: Provenance["sourceType"],
	sourceRef: string,
	maxConcurrent: number,
): Promise<{
	entitiesCreated: number;
	entitiesMerged: number;
	relationsCreated: number;
	conflicts: Conflict[];
	entityNames: string[];
}> {
	const conflicts: Conflict[] = [];
	const allEntityNames: string[] = [];
	let entitiesCreated = 0;
	let entitiesMerged = 0;
	let relationsCreated = 0;

	const results: {
		entitiesCreated: number;
		entitiesMerged: number;
		relationsCreated: number;
		entityNames: string[];
	}[] = [];

	for (let i = 0; i < chunks.length; i += maxConcurrent) {
		const batch = chunks.slice(i, i + maxConcurrent);
		const batchResults = await Promise.all(
			batch.map((chunk, j) => {
				const chunkIndex = i + j;
				console.log(
					`  Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} chars)...`,
				);
				return processChunk(chunk, model, sourceType, sourceRef, chunkIndex, conflicts);
			}),
		);
		results.push(...batchResults);
	}

	for (const result of results) {
		entitiesCreated += result.entitiesCreated;
		entitiesMerged += result.entitiesMerged;
		relationsCreated += result.relationsCreated;
		allEntityNames.push(...result.entityNames);
	}

	return {
		entitiesCreated,
		entitiesMerged,
		relationsCreated,
		conflicts,
		entityNames: allEntityNames,
	};
}

export async function ingestText(
	text: string,
	model: LanguageModel,
	sourceRef = "paste",
	sourceType: Provenance["sourceType"] = "paste",
): Promise<IngestionResult> {
	const startTime = performance.now();

	// Detect language and translate to English if needed
	const lang = detectLanguage(text);
	let processedText = text;
	if (!isEnglish(lang)) {
		console.log(`  Detected ${languageName(lang)}, translating to English...`);
		processedText = await translateToEnglish(text, model);
	}

	const chunks = chunkText(processedText);
	const { getConfig } = await import("../config.ts");
	const config = getConfig();
	const maxConcurrent = config.extraction.maxConcurrent;

	const { entitiesCreated, entitiesMerged, relationsCreated, conflicts, entityNames } =
		await processChunksParallel(chunks, model, sourceType, sourceRef, maxConcurrent);

	const durationMs = Math.round(performance.now() - startTime);

	return {
		entitiesCreated,
		entitiesMerged,
		relationsCreated,
		conflicts,
		chunksProcessed: chunks.length,
		durationMs,
		entityNames,
	};
}

export async function ingestFile(filePath: string, model: LanguageModel): Promise<IngestionResult> {
	const file = Bun.file(filePath);
	const text = await file.text();
	const fileName = filePath.split("/").pop() ?? filePath;
	return ingestText(text, model, fileName, "file");
}

export async function ingestDirectory(
	dirPath: string,
	model: LanguageModel,
): Promise<IngestionResult> {
	const { readdir } = await import("node:fs/promises");
	const entries = await readdir(dirPath, { withFileTypes: true });

	const total: IngestionResult = {
		entitiesCreated: 0,
		entitiesMerged: 0,
		relationsCreated: 0,
		conflicts: [],
		chunksProcessed: 0,
		durationMs: 0,
		entityNames: [],
	};

	for (const entry of entries) {
		if (entry.isDirectory()) continue;
		if (!entry.name.match(/\.(txt|md|json|csv)$/i)) continue;

		const fullPath = `${dirPath}/${entry.name}`;
		console.log(`\n📄 Ingesting: ${entry.name}`);

		try {
			const result = await ingestFile(fullPath, model);
			total.entitiesCreated += result.entitiesCreated;
			total.entitiesMerged += result.entitiesMerged;
			total.relationsCreated += result.relationsCreated;
			total.conflicts.push(...result.conflicts);
			total.chunksProcessed += result.chunksProcessed;
			total.durationMs += result.durationMs;
			total.entityNames.push(...result.entityNames);
		} catch (err) {
			console.error(`  ⚠️  Failed to ingest ${entry.name}:`, err);
		}
	}

	return total;
}
