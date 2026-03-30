export const env = {
	model: process.env.CODEX_MODEL ?? "gpt-5.4",
	binaryPath: process.env.CODEX_BINARY_PATH,
	homePath: process.env.CODEX_HOME,
	dbPath: process.env.LUNA_DB_PATH,
	repoRoot: process.env.LUNA_REPO_ROOT ?? process.cwd(),
};
