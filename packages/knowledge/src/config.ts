import { join } from "node:path";
import { z } from "zod";

const envSchema = z.object({
	NEO4J_URI: z.string().url().default("bolt://localhost:7687"),
	NEO4J_USER: z.string().default("neo4j"),
	NEO4J_PASSWORD: z.string().min(1, "NEO4J_PASSWORD is required"),
});

function loadEnv() {
	const cleaned = Object.fromEntries(
		Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]),
	);

	const result = envSchema.safeParse(cleaned);

	if (!result.success) {
		const messages = result.error.issues
			.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
			.join("\n");
		throw new Error(`Invalid environment variables:\n${messages}`);
	}

	return result.data;
}

let _config: ReturnType<typeof buildConfig> | null = null;

function buildConfig() {
	const env = loadEnv();
	return {
		neo4j: {
			uri: env.NEO4J_URI,
			user: env.NEO4J_USER,
			password: env.NEO4J_PASSWORD,
		},
		extraction: {
			chunkSize: 2000,
			maxConcurrent: 3,
		},
		paths: {
			ingestionLog: join(process.cwd(), "data", "ingestion-log.json"),
			conflictsFile: join(process.cwd(), "data", "conflicts.json"),
		},
	} as const;
}

export function getConfig() {
	if (!_config) {
		_config = buildConfig();
	}
	return _config;
}

export type Config = ReturnType<typeof getConfig>;
