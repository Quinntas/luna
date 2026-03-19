import { closeDriver, getDriver } from "../src/graph/client.ts";
import { graphStats } from "../src/graph/queries.ts";

async function main() {
	const jsonFlag =
		process.argv.includes("--format") &&
		process.argv[process.argv.indexOf("--format") + 1] === "json";

	const driver = getDriver();
	await driver.verifyConnectivity();

	const stats = await graphStats();

	if (jsonFlag) {
		console.log(JSON.stringify(stats, null, 2));
	} else {
		console.log("\n📊 Luna Knowledge Graph Stats\n");
		console.log(`  Entities:    ${stats.entities}`);
		console.log(`  Relations:   ${stats.relations}`);

		if (Object.keys(stats.entityTypes).length > 0) {
			console.log("\n  Entity types:");
			for (const [type, count] of Object.entries(stats.entityTypes)) {
				console.log(`    ${type}: ${count}`);
			}
		}

		if (Object.keys(stats.relationTypes).length > 0) {
			console.log("\n  Relation types:");
			for (const [type, count] of Object.entries(stats.relationTypes)) {
				console.log(`    ${type}: ${count}`);
			}
		}

		console.log("");
	}

	await closeDriver();
}

main().catch((err) => {
	console.error("Stats failed:", err);
	process.exit(1);
});
