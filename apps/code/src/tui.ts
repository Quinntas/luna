import { main, runTui } from "./tui/index.ts";

export { main, runTui };

if (import.meta.main) {
	main().catch((error) => {
		process.stderr.write(`✖ ${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
