import { z } from "zod";
import type { ToolDefinition } from "../types.ts";

const readFileSchema = z.object({
	path: z.string().describe("Absolute or relative path to the file"),
});

const writeFileSchema = z.object({
	path: z.string().describe("Absolute or relative path to the file"),
	content: z.string().describe("Content to write"),
});

type ReadFileInput = z.infer<typeof readFileSchema>;
type WriteFileInput = z.infer<typeof writeFileSchema>;

export const readFileTool: ToolDefinition<ReadFileInput> = {
	name: "read_file",
	description: "Read the contents of a file from the filesystem.",
	schema: readFileSchema,
	execute: async ({ path }) => {
		try {
			const file = Bun.file(path);
			if (!(await file.exists())) {
				return `Error: File not found: ${path}`;
			}
			const content = await file.text();
			if (content.length > 50000) {
				return `File too large (${content.length} chars). First 50000 chars:\n\n${content.slice(0, 50000)}\n\n...[truncated]`;
			}
			return content;
		} catch (err) {
			return `Error reading file: ${err instanceof Error ? err.message : String(err)}`;
		}
	},
	tags: ["file", "read", "filesystem"],
};

export const writeFileTool: ToolDefinition<WriteFileInput> = {
	name: "write_file",
	description:
		"Write content to a file. Creates the file if it doesn't exist, overwrites if it does.",
	schema: writeFileSchema,
	execute: async ({ path, content }) => {
		try {
			await Bun.write(path, content);
			return `Successfully wrote ${content.length} chars to ${path}`;
		} catch (err) {
			return `Error writing file: ${err instanceof Error ? err.message : String(err)}`;
		}
	},
	tags: ["file", "write", "filesystem"],
};
