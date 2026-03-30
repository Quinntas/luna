# Luna Technical Handoff

## Overview

`luna/` is a portable runtime that composes:

- a Codex-backed session runtime
- git/worktree provisioning
- persisted thread state
- worktree-backed checkpoint lifecycle

The main public entrypoint is `luna/src/index.ts`.

## Public Surface

- Runtime: `luna/src/runtime/lunaRuntime.ts`
- Contracts: `luna/src/contracts/ports.ts`, `luna/src/contracts/thread.ts`, `luna/src/contracts/events.ts`
- Storage: `luna/src/storage/memoryThreadStore.ts`, `luna/src/storage/fileThreadStore.ts`

Main public operations exposed through `LunaRuntime`:

- `startThread`
- `resumeThread`
- `restartThread`
- `sendMessage`
- `stopThread`
- `deleteThread`
- `listThreadCheckpoints`
- `getLatestThreadCheckpoint`
- `diffThreadCheckpoints`
- `restoreThreadCheckpoint`
- `deleteThreadCheckpoints`
- `pruneThreadCheckpoints`
- `removeThreadWorktree`
- `waitForIdle`

## Module Boundaries

### Contracts

Contracts live in `luna/src/contracts/index.ts`.

Important files:

- `luna/src/contracts/ports.ts`
- `luna/src/contracts/thread.ts`
- `luna/src/contracts/events.ts`
- `luna/src/contracts/session.ts`
- `luna/src/contracts/worktree.ts`

These define the stable shapes shared across runtime, storage, worktree, and Codex layers.

### Runtime

Runtime orchestration lives in:

- `luna/src/runtime/lunaRuntime.ts`
- `luna/src/runtime/threadController.ts`
- `luna/src/runtime/threadState.ts`
- `luna/src/runtime/eventBus.ts`

Responsibilities:

- thread creation/reopen/restart
- worktree binding orchestration
- Codex session startup and message send
- checkpoint capture scheduling
- cleanup/delete semantics
- event fanout

`luna/src/runtime/lunaRuntime.ts` is the main operational coordinator.

### Codex

Codex integration is centered on `luna/src/codex/managerCore.ts` and `luna/src/codex/codexSessionAdapter.ts`.

Supporting modules:

- `luna/src/codex/codexJsonRpcClient.ts`
- `luna/src/codex/codexSessionProcess.ts`
- `luna/src/codex/codexProtocol.ts`
- `luna/src/codex/codexNotificationHandler.ts`
- `luna/src/codex/codexRequestHandler.ts`
- `luna/src/codex/codexResponseHandler.ts`
- `luna/src/codex/codexThreadState.ts`
- `luna/src/codex/codexTurnStart.ts`

Responsibilities are split as follows:

- process spawn/version check: `luna/src/codex/codexSessionProcess.ts`
- JSON-RPC request tracking: `luna/src/codex/codexJsonRpcClient.ts`
- protocol readers and guards: `luna/src/codex/codexProtocol.ts`
- incoming notifications: `luna/src/codex/codexNotificationHandler.ts`
- incoming server requests: `luna/src/codex/codexRequestHandler.ts`
- outgoing approval/user-input responses: `luna/src/codex/codexResponseHandler.ts`
- turn payload assembly: `luna/src/codex/codexTurnStart.ts`

`luna/src/codex/codexSessionAdapter.ts` is the Luna-facing wrapper that maps Codex runtime events into Luna events.

### Worktree

Worktree logic lives in:

- `luna/src/worktree/worktreeManager.ts`
- `luna/src/worktree/gitCore.ts`
- `luna/src/worktree/checkpoint.ts`
- `luna/src/worktree/checkpointRefs.ts`
- `luna/src/worktree/resolveCwd.ts`
- `luna/src/worktree/naming.ts`

Responsibilities:

- create/reuse worktrees
- remove worktrees explicitly
- run git operations in a worktree cwd
- capture/diff/restore/delete checkpoint refs

`luna/src/worktree/worktreeManager.ts` is the host-facing worktree provisioning layer.

### Storage

Storage implementations:

- in-memory: `luna/src/storage/memoryThreadStore.ts`
- SQLite-backed: `luna/src/storage/sqliteThreadStore.ts`

`luna/src/storage/sqliteThreadStore.ts` uses `bun:sqlite`, a small internal operation queue, and a single-threaded write path to keep persisted runtime state predictable.

## Thread Lifecycle

The main thread state shape is defined in `luna/src/contracts/thread.ts`.

Thread lifecycle rules:

- `startThread(input)` creates a new thread if absent, or reopens an existing thread if present
- `resumeThread(threadId)` reuses persisted thread state and calls back through `startThread`
- `restartThread(threadId, overrides?)` stops the current provider session and reopens the thread
- `stopThread(threadId)` stops the provider session but keeps persisted thread state
- `deleteThread(threadId, options?)` removes persisted state and can optionally delete checkpoints/worktree

If a host wants to delete persisted state without owning provider shutdown, it can use:

- `deleteThread(threadId, { stopSession: false })`

## Worktree Lifecycle

Worktree mode is configured through `luna/src/contracts/worktree.ts`.

Current model:

- `repo-root` uses the repo root directly as cwd
- `reuse-or-create` tries to reuse a matching worktree branch, otherwise creates a new worktree

Important detail:

- worktrees are never auto-removed
- worktree removal is explicit through `removeThreadWorktree(threadId, options?)`

## Checkpoint Lifecycle

Checkpoint behavior is driven from `luna/src/runtime/lunaRuntime.ts` and implemented by `luna/src/worktree/checkpoint.ts`.

Rules:

- completed worktree-backed turns trigger checkpoint capture
- checkpoint refs are stored in `thread.workspace.checkpoints`
- checkpoint numbering is monotonic through `thread.workspace.checkpointSequence`
- deleting/pruning refs does not roll sequence backward

Available operations:

- list: `listThreadCheckpoints`
- latest: `getLatestThreadCheckpoint`
- diff: `diffThreadCheckpoints`
- restore: `restoreThreadCheckpoint`
- delete refs: `deleteThreadCheckpoints`
- prune old refs: `pruneThreadCheckpoints`

Important operational detail:

- checkpoint capture is async
- callers that need deterministic post-turn checkpoint state should call `waitForIdle(threadId)` before reading checkpoint state

## Resume / Recovery Model

Recovery depends on the persisted `LunaThreadRecord` in `luna/src/contracts/thread.ts`.

Persisted state includes:

- provider thread id
- worktree binding
- checkpoint refs
- checkpoint sequence

This means SQLite-backed restarts can preserve:

- which Codex thread is being resumed
- which worktree cwd should be reused
- what checkpoint history exists
- what the next checkpoint ref sequence should be

## Logging Model

`luna/src/contracts/ports.ts` now uses a `pino` logger type.

In practice:

- pass a `pino()` instance into `LunaRuntime`
- structured logging is used internally where runtime/Codex managers emit logs
- logging is optional; the runtime works without it

Examples using Pino live in:

- `luna/examples/basic.ts`
- `luna/examples/sqlite.ts`
- `luna/examples/restore.ts`
- `luna/examples/cleanup.ts`

## Tests

Primary coverage lives in:

- `luna/test/lunaRuntime.test.ts`
- `luna/test/codexHandlers.test.ts`
- `luna/test/fileThreadStore.test.ts`

These cover:

- start/resume/restart semantics
- checkpoint capture/diff/restore/delete/prune
- persisted recovery with file storage
- cleanup behavior
- Codex handler transformations

## Known Boundaries / Expectations

- `luna/` is self-contained and does not depend on the sibling top-level `codex/` or `worktree/` packages at runtime
- Codex is still the only provider implementation in this package
- worktree cleanup remains explicit only
- `waitForIdle()` is part of the intended operational API, not just a test helper

## Recommended Reading Order

1. `luna/src/index.ts`
2. `luna/src/contracts/thread.ts`
3. `luna/src/runtime/lunaRuntime.ts`
4. `luna/src/runtime/threadController.ts`
5. `luna/src/worktree/worktreeManager.ts`
6. `luna/src/codex/codexSessionAdapter.ts`
7. `luna/src/codex/managerCore.ts`
8. supporting Codex helper modules under `luna/src/codex/`
9. `luna/test/lunaRuntime.test.ts`
