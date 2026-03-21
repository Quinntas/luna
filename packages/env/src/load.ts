import { resolve } from "node:path";
import { config as dotenvConfig } from "dotenv";
import { type Env, envSchema } from "./schemas.ts";

let _env: Env | null = null;

export function loadEnv(): Env {
	if (_env) return _env;

	dotenvConfig({ path: resolve(process.cwd(), ".env") });

	const cleaned = Object.fromEntries(
		Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]),
	);

	const result = envSchema.safeParse(cleaned);

	if (!result.success) {
		const messages = result.error.issues
			.map((i) => `  ${i.path.join(".")}: ${i.message}`)
			.join("\n");
		throw new Error(`Invalid environment variables:\n${messages}`);
	}

	_env = result.data;
	return _env;
}
