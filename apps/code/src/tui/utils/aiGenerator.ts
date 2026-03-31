import { getModel } from "@luna/ai";
import { branchNamePrompt, commitMessagePrompt, threadTitlePrompt } from "@luna/prompts";
import { generateText } from "ai";

interface GitChange {
	readonly file: string;
	readonly status: "M" | "A" | "D" | "R" | "??";
}

function formatChanges(changes: (string | GitChange)[], untracked: string[]): string {
	return [
		...changes.map((c) => {
			if (typeof c === "string") return c;
			return `${c.status === "D" ? "deleted" : "modified"}: ${c.file}`;
		}),
		...untracked.map((f) => `new: ${f}`),
	].join("\n");
}

export async function generateThreadTitle(message: string): Promise<string> {
	try {
		const model = getModel();
		const { text } = await generateText({
			model,
			prompt: threadTitlePrompt(message),
		});
		const title = text.trim().slice(0, 40);
		return title || "New thread";
	} catch {
		const words = message
			.toLowerCase()
			.split(/[^a-zA-Z]+/)
			.filter(Boolean)
			.slice(0, 3);
		const title = words.length > 0 ? `feature/${words.join("-")}` : "New thread";
		return title;
	}
}

export async function generateBranchName(
	changes: (string | GitChange)[],
	untracked: string[],
): Promise<string> {
	const allFiles = formatChanges(changes, untracked);
	try {
		const model = getModel();
		const { text } = await generateText({
			model,
			prompt: branchNamePrompt(allFiles),
		});
		const name = sanitizeBranchName(text.trim());
		return name || `luna/pr-${Date.now()}`;
	} catch {
		const words = allFiles
			.slice(0, 200)
			.split(/[^a-zA-Z]+/)
			.filter(Boolean)
			.slice(0, 3);
		const description = words.join("-");
		return sanitizeBranchName(`feature/${description || "update"}`) || `luna/pr-${Date.now()}`;
	}
}

export async function generateCommitMessage(
	changes: (string | GitChange)[],
	untracked: string[],
): Promise<string> {
	const allFiles = formatChanges(changes, untracked);
	try {
		const model = getModel();
		const { text } = await generateText({
			model,
			prompt: commitMessagePrompt(allFiles),
		});
		return text.trim() || `chore: updates`;
	} catch {
		const filesSummary = allFiles.split("\n").slice(0, 5).join(", ");
		return `chore: updates (${filesSummary})`;
	}
}

function sanitizeBranchName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9-/]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 50);
}
