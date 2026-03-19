import type { Entity, Provenance } from "../types.ts";
import { getDriver } from "./client.ts";

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

export async function queryRelated(name: string, _depth = 1): Promise<RelatedEntity[]> {
	const driver = getDriver();
	const session = driver.session();

	try {
		const result = await session.run(
			`MATCH (e:Entity)
			 WHERE toLower(e.name) = toLower($name)
			    OR $name IN [a IN e.aliases | toLower(a)]
			 CALL {
			   WITH e
			   MATCH (e)-[r]->(related:Entity)
			   RETURN related AS target, type(r) AS relType, "outgoing" AS dir,
			          r.confidence AS relConf
			   LIMIT 50
			   UNION
			   WITH e
			   MATCH (e)<-[r]-(related:Entity)
			   RETURN related AS target, type(r) AS relType, "incoming" AS dir,
			          r.confidence AS relConf
			   LIMIT 50
			 }
			 RETURN target, relType, dir, relConf
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

export async function searchEntities(query: string, limit = 20): Promise<Entity[]> {
	const driver = getDriver();
	const session = driver.session();

	try {
		const result = await session.run(
			`MATCH (e:Entity)
			 WHERE toLower(e.name) CONTAINS toLower($query)
			    OR ANY(a IN e.aliases WHERE toLower(a) CONTAINS toLower($query))
			 RETURN e
			 ORDER BY e.confidence DESC
			 LIMIT ${Math.trunc(limit)}`,
			{ query },
		);

		return result.records.map((record: { get: (key: string) => unknown }) =>
			neo4jToEntity((record.get("e") as { properties: Record<string, unknown> }).properties),
		);
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
