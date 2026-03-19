import { closeDriver, getDriver } from "../src/graph/client.ts";
import { queryEntity, queryRelated, searchEntities } from "../src/graph/queries.ts";

async function main() {
	const query = process.argv[2];
	if (!query) {
		console.log("Usage: bun run query.ts <entity-name>");
		console.log("       bun run query.ts --search <partial-name>");
		process.exit(1);
	}

	const driver = getDriver();
	await driver.verifyConnectivity();

	if (query === "--search") {
		const term = process.argv[3];
		if (!term) {
			console.error("Provide a search term.");
			process.exit(1);
		}
		const results = await searchEntities(term);
		if (results.length === 0) {
			console.log("No entities found.");
		} else {
			console.log(`Found ${results.length} entities:\n`);
			for (const e of results) {
				console.log(`  ${e.type}: ${e.name} (confidence: ${e.confidence.toFixed(2)})`);
				if (e.aliases.length > 0) {
					console.log(`    Aliases: ${e.aliases.join(", ")}`);
				}
			}
		}
	} else {
		const entity = await queryEntity(query);
		if (!entity) {
			console.log(`Entity "${query}" not found.`);
			await closeDriver();
			return;
		}

		console.log(`${entity.type}: ${entity.name}`);
		console.log(`  Confidence: ${entity.confidence.toFixed(2)}`);
		if (entity.aliases.length > 0) {
			console.log(`  Aliases: ${entity.aliases.join(", ")}`);
		}
		if (Object.keys(entity.properties).length > 0) {
			console.log("  Properties:");
			for (const [k, v] of Object.entries(entity.properties)) {
				console.log(`    ${k}: ${JSON.stringify(v)}`);
			}
		}
		console.log(`  Sources: ${entity.sources.map((s) => s.sourceRef).join(", ")}`);

		const related = await queryRelated(query);
		if (related.length > 0) {
			console.log(`\n  Related (${related.length}):`);
			for (const r of related) {
				const arrow = r.direction === "outgoing" ? "→" : "←";
				console.log(
					`    ${arrow} [${r.relationType}] ${r.entity.type}: ${r.entity.name} (${r.relationConfidence.toFixed(2)})`,
				);
			}
		}
	}

	await closeDriver();
}

main().catch((err) => {
	console.error("Query failed:", err);
	process.exit(1);
});
