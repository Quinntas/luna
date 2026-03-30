# Luna Runtime Copy

`luna/` composes the portable `codex/` and `worktree/` copies into a thread-oriented runtime.

## Responsibilities

- contract-first thread/session/worktree orchestration
- worktree provisioning and cwd binding
- Codex session startup and message sending
- normalized event forwarding through a stable Luna event surface
- pluggable thread storage

## Design

- `src/contracts`: shared types and ports
- `src/worktree`: worktree provisioning adapter
- `src/codex`: Codex runtime adapter and event mapping
- `src/runtime`: orchestration layer
- `src/storage`: persistence adapters

## Thread Lifecycle

- `startThread(input)` creates a new thread or reopens an existing one
- `resumeThread(threadId)` reopens a persisted thread using stored state
- `restartThread(threadId, overrides?)` stops the current session and starts it again
- `stopThread(threadId)` stops the provider session but keeps persisted state
- `deleteThread(threadId, options?)` removes persisted thread state and can optionally remove worktree/checkpoints

## Development

- run tests with `bun test`
- run package typechecks with `bun run typecheck`
- run examples with `bun run example:basic`, `bun run example:sqlite`, `bun run example:restore`, or `bun run example:cleanup`

## Worktree Lifecycle

- `reuse-or-create` worktree mode reuses a matching branch worktree when possible
- worktrees are never auto-removed
- `removeThreadWorktree(threadId, options?)` is the explicit cleanup path

## Checkpoint Lifecycle

- completed worktree-backed turns capture checkpoints automatically
- checkpoint refs and monotonic `checkpointSequence` are persisted in thread state
- use `waitForIdle(threadId)` before reading checkpoint state if you need deterministic post-turn results

## Runtime API

- `SqliteThreadStore` persists thread state to SQLite for resume-oriented flows
- `LunaRuntime` accepts a `pino` logger instance for structured logging
- completed worktree-backed turns emit `checkpoint.captured` or `checkpoint.error`
- `LunaRuntime` exposes checkpoint helpers:
  - `listThreadCheckpoints(threadId)`
  - `getLatestThreadCheckpoint(threadId)`
  - `diffThreadCheckpoints(threadId, input?)`
  - `restoreThreadCheckpoint(threadId, checkpointRef?)`
  - `deleteThreadCheckpoints(threadId, refs?)`
  - `pruneThreadCheckpoints(threadId, keepLastN)`
- cleanup helpers:
  - `removeThreadWorktree(threadId, options?)`
  - `deleteThread(threadId, options?)`

`deleteThread` supports finer-grained cleanup, including deleting persisted state without
stopping the active provider session (`stopSession: false`) when a host app needs to take
over lifecycle management itself.

Checkpoint refs and checkpoint sequence are persisted in thread state, so SQLite-backed
stores retain checkpoint history metadata across runtime restarts.

## Cleanup Semantics

- `deleteThread(..., { stopSession: false })` removes persisted state without forcing the provider session to stop
- use that mode only if another host/runtime is taking over provider lifecycle ownership
- by default, `deleteThread` attempts to stop the session first

Examples:

- `luna/examples/basic.ts` for the in-memory flow
- `luna/examples/sqlite.ts` for persisted thread state
- `luna/examples/restore.ts` for restore flow
- `luna/examples/cleanup.ts` for cleanup flow
