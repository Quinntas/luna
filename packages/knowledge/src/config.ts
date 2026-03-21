import { join } from "node:path";
import { loadEnv } from "@luna/env";

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
