import { LunaRuntime, SqliteThreadStore } from "../../index.ts";

export function createRuntime(dbPath: string | undefined): LunaRuntime {
	return new LunaRuntime({ store: new SqliteThreadStore({ dbPath }) });
}
