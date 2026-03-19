import { closeDriver } from "../src/graph/client.ts";
import { updateEntityProperties } from "../src/graph/upsert.ts";
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

interface ResolutionLog {
	timestamp: string;
	entityId: string;
	property: string;
	oldValue: unknown;
	newValue: unknown;
	sourceKept: string;
	resolution: string;
}

async function appendResolutionLog(log: ResolutionLog): Promise<void> {
	const { mkdir } = await import("node:fs/promises");
	await mkdir("data", { recursive: true });

	const file = Bun.file("data/resolution-log.json");
	let logs: ResolutionLog[] = [];
	if (await file.exists()) {
		try {
			logs = await file.json();
		} catch {
			logs = [];
		}
	}
	logs.push(log);
	await Bun.write("data/resolution-log.json", JSON.stringify(logs, null, 2));
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
		}

		// Auto-resolve: keep highest-confidence source (first fact)
		const winning = c.facts[0];
		if (!winning) continue;

		c.resolved = true;
		c.resolution = "keep_first";
		console.log(`  → Auto-resolved: keeping value from ${winning.source.sourceRef}\n`);

		// Apply resolution to Neo4j: update the entity property
		const losing = c.facts.slice(1);
		for (const fact of losing) {
			try {
				const { findEntityById } = await import("../src/graph/upsert.ts");
				const entity = await findEntityById(fact.entityId);
				if (entity) {
					const updatedProps = { ...entity.properties };
					updatedProps[fact.property] = winning.value;
					await updateEntityProperties(fact.entityId, updatedProps);
				}
			} catch (err) {
				console.error(`  ⚠️  Failed to update entity ${fact.entityId}:`, err);
			}
		}

		await appendResolutionLog({
			timestamp: new Date().toISOString(),
			entityId: winning.entityId,
			property: winning.property,
			oldValue: losing[0]?.value,
			newValue: winning.value,
			sourceKept: winning.source.sourceRef,
			resolution: "keep_first",
		});
	}

	await saveConflicts(conflicts);
	console.log(`✅ All ${unresolved.length} conflicts resolved and applied to graph.`);
	console.log("   Resolution log: data/resolution-log.json");

	await closeDriver();
}

main().catch((err) => {
	console.error("Resolution failed:", err);
	process.exit(1);
});
