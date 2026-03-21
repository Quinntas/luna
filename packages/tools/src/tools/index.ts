import type { ToolDefinition } from "../types.ts";
import { readFileTool, writeFileTool } from "./file.ts";
import { queryKnowledgeTool } from "./knowledge.ts";
import { queryMemoryTool, storeMemoryTool } from "./memory.ts";
import { getProfileTool, setPreferenceTool } from "./profile.ts";
import { discoverInterestingTopicTool, searchWebTool } from "./web.ts";

export const allBuiltInTools: ToolDefinition[] = [
	searchWebTool,
	discoverInterestingTopicTool,
	readFileTool,
	writeFileTool,
	queryKnowledgeTool,
	queryMemoryTool,
	storeMemoryTool,
	getProfileTool,
	setPreferenceTool,
] as ToolDefinition[];
