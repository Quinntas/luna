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

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastError = err;
			if (attempt < retries) {
				const delay = Math.min(100 * 2 ** (attempt - 1), 2000);
				await Bun.sleep(delay);
			}
		}
	}
	throw lastError;
}

export async function upsertEntity(
	entity: Omit<Entity, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
	const driver = getDriver();
	const session = driver.session();
	const id = generateEntityId(entity.name, entity.type);
	const now = new Date().toISOString();

	try {
		await withRetry(() =>
			session.run(
				`MERGE (e:Entity {id: $id})
				 ON CREATE SET
				   e.name = $name,
				   e.type = $type,
				   e.aliases = $aliases,
				   e.confidence = $confidence,
				   e.properties = $properties,
				   e.sources = $sources,
				   e.createdAt = $createdAt,
				   e.updatedAt = $createdAt
				 ON MATCH SET
				   e.updatedAt = $updatedAt,
				   e.aliases = apoc.coll.union(e.aliases, $aliases),
				   e.confidence = CASE
				     WHEN $confidence > e.confidence THEN $confidence
				     ELSE e.confidence
				   END,
				   e.properties = $properties,
				   e.sources = $sources`,
				{
					id,
					name: entity.name,
					type: entity.type,
					aliases: entity.aliases,
					confidence: entity.confidence,
					properties: JSON.stringify(entity.properties),
					sources: JSON.stringify(entity.sources),
					createdAt: now,
					updatedAt: now,
				},
			),
		);

		return id;
	} finally {
		await session.close();
	}
}

export async function upsertEntities(
	entities: Omit<Entity, "id" | "createdAt" | "updatedAt">[],
): Promise<string[]> {
	const driver = getDriver();
	const session = driver.session();
	const now = new Date().toISOString();

	try {
		const data = entities.map((entity) => ({
			id: generateEntityId(entity.name, entity.type),
			name: entity.name,
			type: entity.type,
			aliases: entity.aliases,
			confidence: entity.confidence,
			properties: JSON.stringify(entity.properties),
			sources: JSON.stringify(entity.sources),
			createdAt: now,
			updatedAt: now,
		}));

		await withRetry(() =>
			session.run(
				`UNWIND $entities AS ent
				 MERGE (e:Entity {id: ent.id})
				 ON CREATE SET
				   e.name = ent.name,
				   e.type = ent.type,
				   e.aliases = ent.aliases,
				   e.confidence = ent.confidence,
				   e.properties = ent.properties,
				   e.sources = ent.sources,
				   e.createdAt = ent.createdAt,
				   e.updatedAt = ent.createdAt
				 ON MATCH SET
				   e.updatedAt = ent.updatedAt,
				   e.aliases = apoc.coll.union(e.aliases, ent.aliases),
				   e.confidence = CASE
				     WHEN ent.confidence > e.confidence THEN ent.confidence
				     ELSE e.confidence
				   END,
				   e.properties = ent.properties,
				   e.sources = ent.sources`,
				{ entities: data },
			),
		);

		return data.map((d) => d.id);
	} finally {
		await session.close();
	}
}

export async function upsertRelation(relation: Omit<Relation, "id">): Promise<string> {
	const driver = getDriver();
	const session = driver.session();
	const id = generateRelationId(relation.sourceId, relation.targetId, relation.type);

	try {
		await withRetry(() =>
			session.run(
				`MATCH (source:Entity {id: $sourceId})
				 MATCH (target:Entity {id: $targetId})
				 MERGE (source)-[r:\`${relation.type}\`]->(target)
				 ON CREATE SET
				   r.id = $id,
				   r.confidence = $confidence,
				   r.properties = $properties,
				   r.sources = $sources
				 ON MATCH SET
				   r.confidence = CASE
				     WHEN $confidence > r.confidence THEN $confidence
				     ELSE r.confidence
				   END`,
				{
					id,
					sourceId: relation.sourceId,
					targetId: relation.targetId,
					confidence: relation.confidence,
					properties: JSON.stringify(relation.properties),
					sources: JSON.stringify(relation.sources),
				},
			),
		);

		return id;
	} finally {
		await session.close();
	}
}

export async function upsertRelations(relations: Omit<Relation, "id">[]): Promise<string[]> {
	const driver = getDriver();
	const session = driver.session();

	try {
		const data = relations.map((rel) => ({
			id: generateRelationId(rel.sourceId, rel.targetId, rel.type),
			sourceId: rel.sourceId,
			targetId: rel.targetId,
			type: rel.type,
			confidence: rel.confidence,
			properties: JSON.stringify(rel.properties),
			sources: JSON.stringify(rel.sources),
		}));

		for (const rel of data) {
			await withRetry(() =>
				session.run(
					`MATCH (source:Entity {id: $sourceId})
					 MATCH (target:Entity {id: $targetId})
					 MERGE (source)-[r:\`${rel.type}\`]->(target)
					 ON CREATE SET
					   r.id = $id,
					   r.confidence = $confidence,
					   r.properties = $properties,
					   r.sources = $sources
					 ON MATCH SET
					   r.confidence = CASE
					     WHEN $confidence > r.confidence THEN $confidence
					     ELSE r.confidence
					   END`,
					rel,
				),
			);
		}

		return data.map((d) => d.id);
	} finally {
		await session.close();
	}
}

export async function findEntityById(id: string): Promise<Entity | null> {
	const driver = getDriver();
	const session = driver.session();

	try {
		const result = await withRetry(() =>
			session.run(`MATCH (e:Entity {id: $id}) RETURN e LIMIT 1`, { id }),
		);

		if (result.records.length === 0) return null;

		const props = result.records[0]?.get("e").properties;
		return neo4jToEntity(props);
	} finally {
		await session.close();
	}
}

export async function findEntitiesByIds(ids: string[]): Promise<Map<string, Entity>> {
	const driver = getDriver();
	const session = driver.session();
	const result = new Map<string, Entity>();

	if (ids.length === 0) return result;

	try {
		const records = await withRetry(() =>
			session.run(`MATCH (e:Entity) WHERE e.id IN $ids RETURN e`, { ids }),
		);

		for (const record of records.records) {
			const entity = neo4jToEntity(
				(record.get("e") as { properties: Record<string, unknown> }).properties,
			);
			result.set(entity.id, entity);
		}

		return result;
	} finally {
		await session.close();
	}
}

export async function findEntityByName(name: string): Promise<Entity | null> {
	const driver = getDriver();
	const session = driver.session();

	try {
		const result = await withRetry(() =>
			session.run(
				`MATCH (e:Entity)
				 WHERE toLower(e.name) = toLower($name)
				    OR $name IN [a IN e.aliases | toLower(a)]
				 RETURN e LIMIT 1`,
				{ name },
			),
		);

		if (result.records.length === 0) return null;

		const props = result.records[0]?.get("e").properties;
		return neo4jToEntity(props);
	} finally {
		await session.close();
	}
}

export async function updateEntityProperties(
	id: string,
	properties: Record<string, unknown>,
): Promise<void> {
	const driver = getDriver();
	const session = driver.session();

	try {
		await withRetry(() =>
			session.run(
				`MATCH (e:Entity {id: $id})
				 SET e.properties = $properties, e.updatedAt = $updatedAt`,
				{ id, properties: JSON.stringify(properties), updatedAt: new Date().toISOString() },
			),
		);
	} finally {
		await session.close();
	}
}

export async function removeSource(sourceRef: string): Promise<number> {
	const driver = getDriver();
	const session = driver.session();

	try {
		const result = await withRetry(() =>
			session.run(`MATCH (e:Entity) RETURN e.id AS id, e.sources AS srcs`),
		);

		let deleted = 0;
		for (const record of result.records) {
			const sources = parseSources(record.get("srcs"));
			const hasSource = sources.some((s) => s.sourceRef === sourceRef);
			if (!hasSource) continue;

			const remaining = sources.filter((s) => s.sourceRef !== sourceRef);
			if (remaining.length === 0) {
				await withRetry(() =>
					session.run(`MATCH (e:Entity {id: $id}) DETACH DELETE e`, {
						id: record.get("id") as string,
					}),
				);
				deleted++;
			} else {
				await withRetry(() =>
					session.run(`MATCH (e:Entity {id: $id}) SET e.sources = $sources`, {
						id: record.get("id") as string,
						sources: JSON.stringify(remaining),
					}),
				);
			}
		}

		return deleted;
	} finally {
		await session.close();
	}
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

export function neo4jToEntity(props: Record<string, unknown>): Entity {
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
