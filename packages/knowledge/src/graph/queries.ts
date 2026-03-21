import type { Entity } from "../types.ts";
import { getDriver } from "./client.ts";
import { neo4jToEntity } from "./upsert.ts";

export interface GraphStats {
	entities: number;
	relations: number;
	conflicts: number;
	entityTypes: Record<string, number>;
	relationTypes: Record<string, number>;
	sourceTypes: Record<string, number>;
}

export async function graphStats(): Promise<GraphStats> {
	const driver = getDriver();

	try {
		const entityCount = await driver.executeQuery("MATCH (e:Entity) RETURN count(e) AS count");
		const relCount = await driver.executeQuery("MATCH ()-[r]->() RETURN count(r) AS count");
		const typeStats = await driver.executeQuery(
			`MATCH (e:Entity)
			 RETURN e.type AS type, count(e) AS count
			 ORDER BY count DESC`,
		);
		const relTypeStats = await driver.executeQuery(
			`MATCH ()-[r]->()
			 RETURN type(r) AS type, count(r) AS count
			 ORDER BY count DESC`,
		);

		const entityTypes: Record<string, number> = {};
		for (const record of typeStats.records) {
			entityTypes[record.get("type") as string] = record.get("count") as number;
		}

		const relationTypes: Record<string, number> = {};
		for (const record of relTypeStats.records) {
			relationTypes[record.get("type") as string] = record.get("count") as number;
		}

		return {
			entities: entityCount.records[0]?.get("count") ?? 0,
			relations: relCount.records[0]?.get("count") ?? 0,
			conflicts: 0,
			entityTypes,
			relationTypes,
			sourceTypes: {},
		};
	} catch {
		return {
			entities: 0,
			relations: 0,
			conflicts: 0,
			entityTypes: {},
			relationTypes: {},
			sourceTypes: {},
		};
	}
}

export async function queryEntity(name: string): Promise<Entity | null> {
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

export interface RelatedEntity {
	entity: Entity;
	relationType: string;
	direction: "outgoing" | "incoming";
	relationConfidence: number;
}

export async function queryRelated(name: string, depth = 1): Promise<RelatedEntity[]> {
	const driver = getDriver();
	const session = driver.session();

	const effectiveDepth = Math.max(1, Math.min(Math.trunc(depth), 5));

	try {
		const result = await session.run(
			`MATCH (e:Entity)
			 WHERE toLower(e.name) = toLower($name)
			    OR $name IN [a IN e.aliases | toLower(a)]
			 CALL {
			   WITH e
			   MATCH path = (e)-[r*1..${effectiveDepth}]->(related:Entity)
			   RETURN related AS target, type(last(r)) AS relType, "outgoing" AS dir,
			          last(r).confidence AS relConf, length(path) AS hops
			   LIMIT 50
			   UNION
			   WITH e
			   MATCH path = (e)<-[r*1..${effectiveDepth}]-(related:Entity)
			   RETURN related AS target, type(last(r)) AS relType, "incoming" AS dir,
			          last(r).confidence AS relConf, length(path) AS hops
			   LIMIT 50
			 }
			 RETURN DISTINCT target, relType, dir, relConf
			 ORDER BY relConf DESC`,
			{ name },
		);

		return result.records.map((record: { get: (key: string) => unknown }) => ({
			entity: neo4jToEntity(
				(record.get("target") as { properties: Record<string, unknown> }).properties,
			),
			relationType: record.get("relType") as string,
			direction: record.get("dir") as "outgoing" | "incoming",
			relationConfidence: record.get("relConf") as number,
		}));
	} finally {
		await session.close();
	}
}

export async function searchEntities(
	query: string,
	options: { limit?: number; type?: string; minConfidence?: number } = {},
): Promise<Entity[]> {
	const driver = getDriver();
	const session = driver.session();
	const limit = Math.trunc(options.limit ?? 20);

	const typeFilter = options.type ? "AND e.type = $type" : "";
	const confidenceFilter = options.minConfidence ? "AND e.confidence >= $minConfidence" : "";

	try {
		const result = await session.run(
			`MATCH (e:Entity)
			 WHERE (toLower(e.name) CONTAINS toLower($query)
			    OR toLower($query) CONTAINS toLower(e.name)
			    OR ANY(a IN e.aliases WHERE toLower(a) CONTAINS toLower($query)))
			 ${typeFilter}
			 ${confidenceFilter}
			 RETURN e
			 ORDER BY e.confidence DESC
			 LIMIT ${limit}`,
			{
				query,
				...(options.type ? { type: options.type } : {}),
				...(options.minConfidence ? { minConfidence: options.minConfidence } : {}),
			},
		);

		return result.records.map((record: { get: (key: string) => unknown }) =>
			neo4jToEntity((record.get("e") as { properties: Record<string, unknown> }).properties),
		);
	} finally {
		await session.close();
	}
}

export async function queryHighConfidence(minConfidence = 0.8): Promise<Entity[]> {
	const driver = getDriver();
	const session = driver.session();

	try {
		const result = await session.run(
			`MATCH (e:Entity)
			 WHERE e.confidence >= $minConfidence
			 RETURN e
			 ORDER BY e.confidence DESC`,
			{ minConfidence },
		);

		return result.records.map((record: { get: (key: string) => unknown }) =>
			neo4jToEntity((record.get("e") as { properties: Record<string, unknown> }).properties),
		);
	} finally {
		await session.close();
	}
}

export async function queryRecent(since: string): Promise<Entity[]> {
	const driver = getDriver();
	const session = driver.session();

	try {
		const result = await session.run(
			`MATCH (e:Entity)
			 WHERE e.createdAt >= $since OR e.updatedAt >= $since
			 RETURN e
			 ORDER BY e.updatedAt DESC`,
			{ since },
		);

		return result.records.map((record: { get: (key: string) => unknown }) =>
			neo4jToEntity((record.get("e") as { properties: Record<string, unknown> }).properties),
		);
	} finally {
		await session.close();
	}
}

export async function exportGraph(): Promise<{
	entities: Entity[];
	relations: {
		id: string;
		sourceId: string;
		targetId: string;
		type: string;
		confidence: number;
		properties: Record<string, unknown>;
	}[];
}> {
	const driver = getDriver();

	const entityResult = await driver.executeQuery(`MATCH (e:Entity) RETURN e ORDER BY e.name`);
	const entities = entityResult.records.map((r) =>
		neo4jToEntity((r.get("e") as { properties: Record<string, unknown> }).properties),
	);

	const relResult = await driver.executeQuery(
		`MATCH (source:Entity)-[r]->(target:Entity)
		 RETURN source.id AS sourceId, target.id AS targetId,
		        type(r) AS type, r.id AS id,
		        r.confidence AS confidence, r.properties AS properties`,
	);
	const relations = relResult.records.map((r) => ({
		id: r.get("id") as string,
		sourceId: r.get("sourceId") as string,
		targetId: r.get("targetId") as string,
		type: r.get("type") as string,
		confidence: r.get("confidence") as number,
		properties:
			typeof r.get("properties") === "string"
				? (JSON.parse(r.get("properties") as string) as Record<string, unknown>)
				: ((r.get("properties") as Record<string, unknown>) ?? {}),
	}));

	return { entities, relations };
}

export async function clearGraph(): Promise<void> {
	const driver = getDriver();
	await driver.executeQuery("MATCH (n) DETACH DELETE n");
}
