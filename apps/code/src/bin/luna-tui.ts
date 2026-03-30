import { main } from "../tui.ts";

main().catch((error) => {
	process.stderr.write(`✖ ${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
});
