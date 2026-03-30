export { main, runTui } from "./tui/index.ts";

if (import.meta.main) {
	main().catch((error) => {
		process.stderr.write(`✖ ${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}

import { main } from "./tui/index.ts";
