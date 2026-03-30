import path from "node:path";

import pino from "pino";

import { LunaRuntime, SqliteThreadStore } from "../src/index";

async function main() {
  const logger = pino({
    name: "luna-example-sqlite",
    level: process.env.LOG_LEVEL ?? "info",
  });
  const storePath = path.join(process.cwd(), ".luna", "threads.sqlite");
  const runtime = new LunaRuntime({
    store: new SqliteThreadStore({ filePath: storePath }),
    logger,
  });

  runtime.on((event) => {
    logger.info({ eventType: event.type, payload: event.payload }, "luna event");
  });

  const thread = await runtime.startThread({
    threadId: "sqlite-example-thread",
    title: "Search repo with persisted Luna thread",
    repoRoot: process.cwd(),
    worktree: {
      mode: "reuse-or-create",
      preferredBranchName: "feature/sqlite-example-search",
    },
    codex: {
      model: process.env.CODEX_MODEL ?? "gpt-5.3-codex",
      runtimeMode: "approval-required",
      binaryPath: process.env.CODEX_BINARY_PATH,
      homePath: process.env.CODEX_HOME,
    },
  });

  logger.info({ storePath }, "thread persisted to sqlite");
  logger.info(
    {
      threadId: thread.id,
      providerThreadId: thread.codex.providerThreadId,
      cwd: thread.workspace.cwd,
    },
    "resumable thread",
  );

  await runtime.sendMessage({
    threadId: thread.id,
    text: "Search this repository for authentication flow and explain the key files.",
    interactionMode: "default",
    reasoningEffort: "high",
  });

  logger.info(
    { checkpoints: await runtime.listThreadCheckpoints(thread.id) },
    "thread checkpoints",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
