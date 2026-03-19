import type { Entity, Provenance, Relation } from "../types.ts";
import { getDriver } from "./client.ts";

function generateEntityId(name: string, type: string): string {
	const normalizedName = name.toLowerCase().trim().replace(/\s+/g, " ");
	const hash = Bun.hash(`${type}:${normalizedName}`);
	return hash.toString(16);
}

function generateRelationId(sourceId: string, targetId: string, type: string): string {
	const hash = Bun.hash(`${sourceId}:${type}:${targetId}`);
	return hash.toString(16);
}

export function createEntityId(name: string, type: string): string {
	return generateEntityId(name, type);
}

export function createRelationId(sourceId: string, targetId: string, type: string): string {
	return generateRelationId(sourceId, targetId, type);
}

export async function upsertEntity(
	entity: Omit<Entity, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
	const driver = getDriver();
	const session = driver.session();
	const id = generateEntityId(entity.name, entity.type);
	const now = new Date().toISOString();

	try {
		const existing = await findEntityById(id);

		if (!existing) {
			await session.run(
				`CREATE (e:Entity {
					id: $id,
					name: $name,
					type: $type,
					aliases: $aliases,
					confidence: $confidence,
					properties: $properties,
					sources: $sources,
					createdAt: $createdAt,
					updatedAt: $createdAt
				})`,
				{
					id,
					name: entity.name,
					type: entity.type,
					aliases: entity.aliases,
					confidence: entity.confidence,
					properties: JSON.stringify(entity.properties),
					sources: JSON.stringify(entity.sources),
					createdAt: now,
				},
			);
		} else {
			const mergedAliases = [...new Set([...existing.aliases, ...entity.aliases])];
			const mergedSources = mergeSources(existing.sources, entity.sources);
			const mergedProperties = { ...entity.properties, ...existing.properties };
			const maxConfidence = Math.max(existing.confidence, entity.confidence);

			await session.run(
				`MATCH (e:Entity {id: $id})
				 SET e.aliases = $aliases,
				     e.confidence = $confidence,
				     e.properties = $properties,
				     e.sources = $sources,
				     e.updatedAt = $updatedAt`,
				{
					id,
					aliases: mergedAliases,
					confidence: maxConfidence,
					properties: JSON.stringify(mergedProperties),
					sources: JSON.stringify(mergedSources),
					updatedAt: now,
				},
			);
		}

		return id;
	} finally {
		await session.close();
	}
}

export async function upsertRelation(relation: Omit<Relation, "id">): Promise<string> {
	const driver = getDriver();
	const session = driver.session();
	const id = generateRelationId(relation.sourceId, relation.targetId, relation.type);

	try {
		const result = await session.run(
			`MATCH (source:Entity {id: $sourceId})-[r:\`${relation.type}\`]->(target:Entity {id: $targetId})
			 RETURN r.id AS rid, r.confidence AS conf, r.sources AS srcs`,
			{ sourceId: relation.sourceId, targetId: relation.targetId },
		);

		if (result.records.length === 0) {
			await session.run(
				`MATCH (source:Entity {id: $sourceId})
				 MATCH (target:Entity {id: $targetId})
				 CREATE (source)-[r:\`${relation.type}\` {
				   id: $id,
				   confidence: $confidence,
				   properties: $properties,
				   sources: $sources
				 }]->(target)`,
				{
					id,
					sourceId: relation.sourceId,
					targetId: relation.targetId,
					confidence: relation.confidence,
					properties: JSON.stringify(relation.properties),
					sources: JSON.stringify(relation.sources),
				},
			);
		} else {
			const record = result.records[0];
			if (!record) return id;
			const existingConfidence = record.get("conf") as number;
			const existingSources = parseSources(record.get("srcs"));
			const mergedSources = mergeSources(existingSources, relation.sources);
			const maxConfidence = Math.max(existingConfidence, relation.confidence);

			await session.run(
				`MATCH ()-[r {id: $id}]->()
				 SET r.confidence = $confidence,
				     r.sources = $sources`,
				{
					id: record.get("rid") as string,
					confidence: maxConfidence,
					sources: JSON.stringify(mergedSources),
				},
			);
		}

		return id;
	} finally {
		await session.close();
	}
}

export async function findEntityByName(name: string): Promise<Entity | null> {
	const driver = getDriver();
	const session = driver.session();

	try {
		const result = await session.run(
			`MATCH (e:Entity)
			 WHERE toLower(e.name) = toLower($name)
			    OR $name IN [a IN e.aliases | toLower(a)]
			 RETURN e LIMIT 1`,
			{ name },
		);

		if (result.records.length === 0) return null;

		const props = result.records[0]?.get("e").properties;
		return neo4jToEntity(props);
	} finally {
		await session.close();
	}
}

export async function findEntityById(id: string): Promise<Entity | null> {
	const driver = getDriver();
	const session = driver.session();

	try {
		const result = await session.run(`MATCH (e:Entity {id: $id}) RETURN e LIMIT 1`, { id });

		if (result.records.length === 0) return null;

		const props = result.records[0]?.get("e").properties;
		return neo4jToEntity(props);
	} finally {
		await session.close();
	}
}

export async function removeSource(sourceRef: string): Promise<number> {
	const driver = getDriver();
	const session = driver.session();

	try {
		const result = await session.run(
			`MATCH (e:Entity)
			 WHERE e.sources CONTAINS $sourceRef
			 RETURN e.id AS id, e.sources AS srcs`,
			{ sourceRef },
		);

		let deleted = 0;
		for (const record of result.records) {
			const sources = parseSources(record.get("srcs"));
			const remaining = sources.filter((s) => s.sourceRef !== sourceRef);
			if (remaining.length === 0) {
				await session.run(`MATCH (e:Entity {id: $id}) DETACH DELETE e`, {
					id: record.get("id") as string,
				});
				deleted++;
			}
		}

		return deleted;
	} finally {
		await session.close();
	}
}

function mergeSources(a: Provenance[], b: Provenance[]): Provenance[] {
	const seen = new Set<string>();
	const merged: Provenance[] = [];

	for (const p of [...a, ...b]) {
		const key = `${p.sourceType}:${p.sourceRef}:${p.chunkIndex ?? ""}`;
		if (!seen.has(key)) {
			seen.add(key);
			merged.push(p);
		}
	}

	return merged;
}

function parseSources(raw: unknown): Provenance[] {
	if (typeof raw === "string") {
		try {
			return JSON.parse(raw) as Provenance[];
		} catch {
			return [];
		}
	}
	return (raw as Provenance[]) ?? [];
}

function neo4jToEntity(props: Record<string, unknown>): Entity {
	return {
		id: props.id as string,
		name: props.name as string,
		type: props.type as string,
		aliases: (props.aliases as string[]) ?? [],
		properties:
			typeof props.properties === "string"
				? (JSON.parse(props.properties as string) as Record<string, unknown>)
				: ((props.properties as Record<string, unknown>) ?? {}),
		confidence: props.confidence as number,
		sources: parseSources(props.sources),
		createdAt: props.createdAt as string,
		updatedAt: props.updatedAt as string,
	};
}
