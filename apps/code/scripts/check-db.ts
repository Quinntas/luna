import { listThreads } from "@luna/db";

const dbPath = process.env.LUNA_DB_PATH ?? "data/luna.db";

console.log("DB Path:", dbPath);
console.log("");

interface ThreadData {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	workspace?: { mode?: string; branch?: string; worktreePath?: string };
	history?: { role: "user" | "assistant"; content: string }[];
}

const threads = listThreads<ThreadData>(dbPath);

if (threads.length === 0) {
	console.log("No threads found.");
	process.exit(0);
}

console.log(`Found ${threads.length} thread(s):\n`);

for (const thread of threads) {
	console.log("=".repeat(60));
	console.log(`ID:        ${thread.id}`);
	console.log(`Title:     ${thread.title}`);
	console.log(`Created:   ${thread.createdAt}`);
	console.log(`Updated:   ${thread.updatedAt}`);
	console.log("");

	console.log("Workspace:");
	console.log(`  Mode:         ${thread.workspace?.mode ?? "unknown"}`);
	console.log(`  Branch:       ${thread.workspace?.branch ?? "none"}`);
	console.log(`  WorktreePath: ${thread.workspace?.worktreePath ?? "none"}`);
	console.log("");

	console.log("History:");
	if (thread.history && thread.history.length > 0) {
		thread.history.forEach((entry, idx) => {
			const prefix = entry.role === "user" ? "👤" : "🤖";
			const lines = entry.content.split("\n");
			console.log(`  ${idx + 1}. ${prefix} ${entry.role}:`);
			console.log(`     [${lines.length} lines]`);
			lines.slice(0, 5).forEach((line, i) => {
				console.log(`     ${i + 1}: ${line.slice(0, 70)}`);
			});
			if (lines.length > 5) {
				console.log(`     ...`);
			}
		});
	} else {
		console.log("  (empty)");
	}
	console.log("");
}
