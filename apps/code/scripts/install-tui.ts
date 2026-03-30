import { access, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const binDir = path.join(os.homedir(), ".local", "bin");
const targetPath = path.join(binDir, "luna");
const legacyTargetPath = path.join(binDir, "luna-tui");
const sourcePath = path.resolve(import.meta.dir, "..", "dist", "luna-tui");
const pathExportLine = 'export PATH="$HOME/.local/bin:$PATH"';
const pathExportBlock = ["# Added by Luna TUI installer", pathExportLine].join("\n");

function getShellRcPath(): string {
	const shellName = path.basename(process.env.SHELL ?? "");
	if (shellName === "zsh") {
		return path.join(os.homedir(), ".zshrc");
	}

	if (shellName === "bash") {
		return path.join(os.homedir(), ".bashrc");
	}

	return path.join(os.homedir(), ".profile");
}

async function ensurePathExport(): Promise<{ rcPath: string; updated: boolean }> {
	const rcPath = getShellRcPath();
	const current = await readFile(rcPath, "utf8").catch(() => "");
	if (current.includes(pathExportLine) || current.includes(pathExportBlock)) {
		return { rcPath, updated: false };
	}

	const nextContent = current
		? `${current.trimEnd()}\n\n${pathExportBlock}\n`
		: `${pathExportBlock}\n`;
	await writeFile(rcPath, nextContent, "utf8");
	return { rcPath, updated: true };
}

async function main(): Promise<void> {
	await mkdir(binDir, { recursive: true });
	await access(sourcePath);
	await symlink(sourcePath, targetPath, "file").catch(async (error: NodeJS.ErrnoException) => {
		if (error.code !== "EEXIST") {
			throw error;
		}

		await rm(targetPath, { force: true });
		await symlink(sourcePath, targetPath, "file");
	});
	await rm(legacyTargetPath, { force: true });
	const pathSetup = await ensurePathExport();

	process.stdout.write(`Installed luna at ${targetPath}\n`);
	if (pathSetup.updated) {
		process.stdout.write(`Added ~/.local/bin to PATH in ${pathSetup.rcPath}\n`);
		process.stdout.write(
			`Open a new shell or run 'source ${pathSetup.rcPath}' to use 'luna' immediately.\n`,
		);
	} else {
		process.stdout.write(`PATH already includes ~/.local/bin in ${pathSetup.rcPath}\n`);
	}
	process.stdout.write(`Run 'luna' from any repo. Current cwd will be used as repo root.\n`);
}

main().catch((error) => {
	process.stderr.write(`✖ ${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
});
