import { closeDriver } from "../src/graph/client.ts";
import { exportGraph } from "../src/graph/queries.ts";

async function main() {
	const outputPath = process.argv[2] ?? "data/graph-export.json";

	const { mkdir } = await import("node:fs/promises");
	await mkdir(outputPath.split("/").slice(0, -1).join("/") || ".", {
		recursive: true,
	});

	const data = await exportGraph();
	await Bun.write(outputPath, JSON.stringify(data, null, 2));

	console.log(`✅ Exported ${data.entities.length} entities, ${data.relations.length} relations`);
	console.log(`   → ${outputPath}`);

	await closeDriver();
}

main().catch((err) => {
	console.error("Export failed:", err);
	process.exit(1);
});
