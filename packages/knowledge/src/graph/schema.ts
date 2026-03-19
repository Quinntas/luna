import { getDriver } from "./client.ts";

const SCHEMA_QUERIES = [
	// Unique entity IDs
	`CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
	 FOR (e:Entity) REQUIRE e.id IS UNIQUE`,

	// Index on name for lookups
	`CREATE INDEX entity_name_idx IF NOT EXISTS
	 FOR (e:Entity) ON (e.name)`,

	// Index on type for filtering
	`CREATE INDEX entity_type_idx IF NOT EXISTS
	 FOR (e:Entity) ON (e.type)`,

	// Index on confidence for querying high-confidence facts
	`CREATE INDEX entity_confidence_idx IF NOT EXISTS
	 FOR (e:Entity) ON (e.confidence)`,
];

export async function initSchema(): Promise<void> {
	const driver = getDriver();
	const session = driver.session();

	try {
		for (const query of SCHEMA_QUERIES) {
			await session.run(query);
		}
		console.log("✅ Schema initialized (constraints + indexes)");
	} finally {
		await session.close();
	}
}
