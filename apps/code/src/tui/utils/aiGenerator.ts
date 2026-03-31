import { branchNamePrompt, commitMessagePrompt, threadTitlePrompt } from "@luna/prompts";
import { generateText, type LanguageModel } from "ai";

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

export async function generateThreadTitle(message: string, model: LanguageModel): Promise<string> {
	const { text } = await generateText({
		model,
		prompt: threadTitlePrompt(message),
	});
	const title = text.trim().slice(0, 40);
	if (!title) {
		throw new Error("Failed to generate thread title");
	}
	return title;
}

export async function generateBranchName(
	changes: (string | GitChange)[],
	model: LanguageModel,
): Promise<string> {
	const allFiles = formatChanges(changes, []);
	const { text } = await generateText({
		model,
		prompt: branchNamePrompt(allFiles),
	});
	const name = sanitizeBranchName(text.trim());
	if (!name) {
		throw new Error("Failed to generate branch name");
	}
	return name;
}

export async function generateCommitMessage(
	changes: (string | GitChange)[],
	model: LanguageModel,
): Promise<string> {
	const allFiles = formatChanges(changes, []);
	const { text } = await generateText({
		model,
		prompt: commitMessagePrompt(allFiles),
	});
	const msg = text.trim();
	if (!msg) {
		throw new Error("Failed to generate commit message");
	}
	return msg;
}

function sanitizeBranchName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9-/]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 50);
}
