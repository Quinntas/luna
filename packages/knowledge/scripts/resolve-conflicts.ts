import { closeDriver } from "../src/graph/client.ts";
import type { Conflict } from "../src/types.ts";

async function loadConflicts(): Promise<Conflict[]> {
	try {
		const file = Bun.file("data/conflicts.json");
		if (!(await file.exists())) return [];
		return await file.json();
	} catch {
		return [];
	}
}

async function saveConflicts(conflicts: Conflict[]): Promise<void> {
	const { mkdir } = await import("node:fs/promises");
	await mkdir("data", { recursive: true });
	await Bun.write("data/conflicts.json", JSON.stringify(conflicts, null, 2));
}

async function main() {
	const conflicts = await loadConflicts();
	const unresolved = conflicts.filter((c) => !c.resolved);

	if (unresolved.length === 0) {
		console.log("✅ No unresolved conflicts.");
		await closeDriver();
		return;
	}

	console.log(`⚠️  ${unresolved.length} unresolved conflict(s):\n`);

	for (let i = 0; i < unresolved.length; i++) {
		const c = unresolved[i];
		if (!c) continue;
		console.log(`[${i + 1}/${unresolved.length}] Conflict: ${c.type}`);
		for (const fact of c.facts) {
			console.log(`  Source: ${fact.source.sourceRef} (chunk ${fact.source.chunkIndex ?? "n/a"})`);
			console.log(`  Property: ${fact.property}`);
			console.log(`  Value: ${JSON.stringify(fact.value)}`);
			console.log(`  Raw: ${fact.source.rawText.slice(0, 100)}...`);
			console.log("");
		}

		// Auto-resolve: keep the first (oldest) value
		c.resolved = true;
		c.resolution = "keep_first";
		console.log("  → Auto-resolved: keeping first value\n");
	}

	await saveConflicts(conflicts);
	console.log(`✅ All ${unresolved.length} conflicts resolved (kept first value).`);
	console.log("   Review data/conflicts.json to verify.");

	await closeDriver();
}

main().catch((err) => {
	console.error("Resolution failed:", err);
	process.exit(1);
});
