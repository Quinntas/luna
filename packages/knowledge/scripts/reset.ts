import { closeDriver, getDriver } from "../src/graph/client.ts";
import { clearGraph } from "../src/graph/queries.ts";
import { initSchema } from "../src/graph/schema.ts";

async function main() {
	const driver = getDriver();
	await driver.verifyConnectivity();

	console.log("⚠️  This will delete ALL data in the graph.");
	console.log("Press Ctrl+C to cancel, or wait 3 seconds...\n");
	await Bun.sleep(3000);

	await clearGraph();
	console.log("🗑️  All nodes and relationships deleted.");

	await initSchema();
	console.log("✅ Schema re-initialized.");

	await closeDriver();
}

main().catch((err) => {
	console.error("Reset failed:", err);
	process.exit(1);
});
