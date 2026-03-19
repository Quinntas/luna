import { closeDriver, getDriver } from "../src/graph/client.ts";
import { queryEntity, queryRelated, searchEntities } from "../src/graph/queries.ts";

async function main() {
	const args = process.argv.slice(2);

	// Parse flags
	const jsonFlag = args.includes("--format") && args[args.indexOf("--format") + 1] === "json";
	const searchFlag = args.includes("--search");
	const typeIdx = args.indexOf("--type");
	const type = typeIdx !== -1 ? args[typeIdx + 1] : undefined;
	const confIdx = args.indexOf("--min-confidence");
	const minConfidence = confIdx !== -1 ? Number(args[confIdx + 1]) : undefined;

	// Extract positional args (skip flags and their values)
	const skipNext = new Set<number>();
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--format" || args[i] === "--type" || args[i] === "--min-confidence") {
			skipNext.add(i + 1);
		}
	}
	const positionalArgs = args.filter((a, i) => !a.startsWith("--") && !skipNext.has(i));

	const query = searchFlag ? "--search" : positionalArgs[0];

	if (!query) {
		console.log("Usage: bun run query.ts [--format json] <entity-name>");
		console.log(
			"       bun run query.ts [--format json] --search [--type <type>] [--min-confidence <n>] <term>",
		);
		process.exit(1);
	}

	const driver = getDriver();
	await driver.verifyConnectivity();

	if (query === "--search") {
		const term = positionalArgs[0];
		if (!term) {
			console.error("Provide a search term.");
			process.exit(1);
		}

		const results = await searchEntities(term, { type, minConfidence });

		if (jsonFlag) {
			console.log(JSON.stringify(results, null, 2));
		} else if (results.length === 0) {
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
			if (jsonFlag) {
				console.log("null");
			} else {
				console.log(`Entity "${query}" not found.`);
			}
			await closeDriver();
			return;
		}

		if (jsonFlag) {
			const related = await queryRelated(query);
			console.log(JSON.stringify({ entity, related }, null, 2));
		} else {
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
	}

	await closeDriver();
}

main().catch((err) => {
	console.error("Query failed:", err);
	process.exit(1);
});
