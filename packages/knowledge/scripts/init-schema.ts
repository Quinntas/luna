import { closeDriver, getDriver } from "../src/graph/client.ts";
import { initSchema } from "../src/graph/schema.ts";

async function main() {
	console.log("Connecting to Neo4j...");
	const driver = getDriver();
	await driver.verifyConnectivity();
	console.log("✅ Connected");

	await initSchema();

	await closeDriver();
	console.log("Done.");
}

main().catch((err) => {
	console.error("Schema init failed:", err);
	process.exit(1);
});
