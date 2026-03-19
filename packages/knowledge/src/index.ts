export { createModel, getModel } from "@luna/ai";
export type { LanguageModel } from "ai";
export { normalizeRelationType } from "./canonicalize/resolver.ts";
export { extractFromText } from "./extract/extractor.ts";
export {
	detectLanguage,
	isEnglish,
	languageName,
	translateToEnglish,
} from "./extract/translate.ts";
export { closeDriver, neo4jClient } from "./graph/client.ts";
export {
	clearGraph,
	exportGraph,
	graphStats,
	queryEntity,
	queryHighConfidence,
	queryRecent,
	queryRelated,
	searchEntities,
} from "./graph/queries.ts";
export {
	findEntityById,
	findEntityByName,
	removeSource,
	upsertEntity,
	upsertRelation,
} from "./graph/upsert.ts";
export { ingestDirectory, ingestFile, ingestText } from "./ingest/index.ts";
export type {
	Conflict,
	Entity,
	ExtractionResult,
	IngestionResult,
	Provenance,
	Relation,
} from "./types.ts";
export { assignConfidence } from "./validate/confidence.ts";
export { createProvenance } from "./validate/provenance.ts";
