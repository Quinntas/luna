export type EntityType =
	| "Person"
	| "Organization"
	| "Project"
	| "Event"
	| "Location"
	| "Concept"
	| "Technology"
	| "Document"
	| (string & {});

export interface Provenance {
	sourceType: "paste" | "file" | "email" | "chat";
	sourceRef: string;
	chunkIndex?: number;
	extractedAt: string;
	rawText: string;
}

export interface Entity {
	id: string;
	name: string;
	type: EntityType;
	aliases: string[];
	properties: Record<string, unknown>;
	confidence: number;
	sources: Provenance[];
	createdAt: string;
	updatedAt: string;
}

export interface Relation {
	id: string;
	sourceId: string;
	targetId: string;
	type: string;
	properties: Record<string, unknown>;
	confidence: number;
	sources: Provenance[];
}

export interface ExtractedEntity {
	name: string;
	type: string;
	aliases: string[];
	properties: Record<string, unknown>;
}

export interface ExtractedRelation {
	source: string;
	target: string;
	type: string;
	properties: Record<string, unknown>;
}

export interface ExtractionResult {
	entities: ExtractedEntity[];
	relations: ExtractedRelation[];
	summary: string;
}

export interface ResolvedEntity {
	entity: Entity;
	action: "create" | "merge";
	mergedIntoId?: string;
}

export interface ResolvedRelation {
	relation: Relation;
	action: "create" | "skip";
}

export interface Conflict {
	id: string;
	type: "contradiction" | "ambiguity";
	facts: {
		entityId: string;
		property: string;
		value: unknown;
		source: Provenance;
	}[];
	resolved: boolean;
	resolution?: "keep_first" | "keep_second" | "merge" | "discard_all";
}

export interface IngestionResult {
	entitiesCreated: number;
	entitiesMerged: number;
	relationsCreated: number;
	conflicts: Conflict[];
	chunksProcessed: number;
	durationMs: number;
	entityNames: string[];
}
