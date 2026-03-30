import pino from "pino";

import { LunaRuntime, SqliteThreadStore } from "../src/index";

async function main() {
  const logger = pino({
    name: "luna-example-cleanup",
    level: process.env.LOG_LEVEL ?? "info",
  });
  const runtime = new LunaRuntime({
    store: new SqliteThreadStore({ filePath: `${process.cwd()}/.luna/cleanup-threads.sqlite` }),
    logger,
  });

  const thread = await runtime.startThread({
    threadId: "cleanup-example-thread",
    title: "Cleanup example",
    repoRoot: process.cwd(),
    worktree: {
      mode: "reuse-or-create",
      preferredBranchName: "feature/cleanup-example-thread",
    },
    codex: {
      model: process.env.CODEX_MODEL ?? "gpt-5.3-codex",
      runtimeMode: "approval-required",
      binaryPath: process.env.CODEX_BINARY_PATH,
      homePath: process.env.CODEX_HOME,
    },
  });

  await runtime.sendMessage({
    threadId: thread.id,
    text: "Search this repository for auth/session entrypoints.",
  });
  await runtime.waitForIdle(thread.id);

  logger.info({ checkpoints: await runtime.listThreadCheckpoints(thread.id) }, "before prune");
  await runtime.pruneThreadCheckpoints(thread.id, 1);
  logger.info({ checkpoints: await runtime.listThreadCheckpoints(thread.id) }, "after prune");

  await runtime.deleteThread(thread.id, {
    deleteCheckpoints: true,
    removeWorktree: true,
  });
  logger.info({ threadId: thread.id }, "deleted thread");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
