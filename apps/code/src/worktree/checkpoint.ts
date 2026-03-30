import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { GitCommandError } from "./errors";
import type {
  CaptureCheckpointInput,
  DeleteCheckpointRefsInput,
  DiffCheckpointsInput,
  HasCheckpointRefInput,
  RestoreCheckpointInput,
} from "./types";
import { GitWorktreeClient } from "./gitCore";

async function withTempDir<T>(run: (tempDir: string) => Promise<T>): Promise<T> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "worktree-checkpoint-"));
  try {
    return await run(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function resolveCommit(
  client: GitWorktreeClient,
  cwd: string,
  ref: string,
): Promise<string | null> {
  const result = await client.execute({
    operation: "WorktreeCheckpoint.resolveCommit",
    cwd,
    args: ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`],
    allowNonZeroExit: true,
  });
  if (result.code !== 0) return null;
  const commit = result.stdout.trim();
  return commit.length > 0 ? commit : null;
}

async function hasHeadCommit(client: GitWorktreeClient, cwd: string): Promise<boolean> {
  const result = await client.execute({
    operation: "WorktreeCheckpoint.hasHeadCommit",
    cwd,
    args: ["rev-parse", "--verify", "HEAD"],
    allowNonZeroExit: true,
  });
  return result.code === 0;
}

export class WorktreeCheckpointStore {
  constructor(private readonly git: GitWorktreeClient = new GitWorktreeClient()) {}

  async isGitRepository(cwd: string): Promise<boolean> {
    try {
      const result = await this.git.execute({
        operation: "WorktreeCheckpoint.isGitRepository",
        cwd,
        args: ["rev-parse", "--is-inside-work-tree"],
        allowNonZeroExit: true,
      });
      return result.code === 0 && result.stdout.trim() === "true";
    } catch {
      return false;
    }
  }

  async captureCheckpoint(input: CaptureCheckpointInput): Promise<void> {
    await withTempDir(async (tempDir) => {
      const tempIndexPath = path.join(tempDir, `index-${randomUUID()}`);
      const commitEnv: NodeJS.ProcessEnv = {
        ...process.env,
        GIT_INDEX_FILE: tempIndexPath,
        GIT_AUTHOR_NAME: "Worktree Runtime",
        GIT_AUTHOR_EMAIL: "worktree-runtime@local",
        GIT_COMMITTER_NAME: "Worktree Runtime",
        GIT_COMMITTER_EMAIL: "worktree-runtime@local",
      };

      if (await hasHeadCommit(this.git, input.cwd)) {
        await this.git.execute({
          operation: "WorktreeCheckpoint.capture.readTree",
          cwd: input.cwd,
          args: ["read-tree", "HEAD"],
          env: commitEnv,
        });
      }

      await this.git.execute({
        operation: "WorktreeCheckpoint.capture.addAll",
        cwd: input.cwd,
        args: ["add", "-A", "--", "."],
        env: commitEnv,
      });

      const writeTreeResult = await this.git.execute({
        operation: "WorktreeCheckpoint.capture.writeTree",
        cwd: input.cwd,
        args: ["write-tree"],
        env: commitEnv,
      });
      const treeOid = writeTreeResult.stdout.trim();
      if (!treeOid) {
        throw new GitCommandError({
          operation: "WorktreeCheckpoint.captureCheckpoint",
          command: "git write-tree",
          cwd: input.cwd,
          detail: "git write-tree returned an empty tree oid.",
        });
      }

      const message = `worktree checkpoint ref=${input.checkpointRef}`;
      const commitTreeArgs = ["commit-tree", treeOid, "-m", message];
      if (await hasHeadCommit(this.git, input.cwd)) {
        const headCommit = await resolveCommit(this.git, input.cwd, "HEAD");
        if (headCommit) commitTreeArgs.push("-p", headCommit);
      }
      const commitTreeResult = await this.git.execute({
        operation: "WorktreeCheckpoint.capture.commitTree",
        cwd: input.cwd,
        args: commitTreeArgs,
        env: commitEnv,
      });
      const commitOid = commitTreeResult.stdout.trim();
      if (!commitOid) {
        throw new GitCommandError({
          operation: "WorktreeCheckpoint.captureCheckpoint",
          command: "git commit-tree",
          cwd: input.cwd,
          detail: "git commit-tree returned an empty commit oid.",
        });
      }

      await this.git.execute({
        operation: "WorktreeCheckpoint.capture.updateRef",
        cwd: input.cwd,
        args: ["update-ref", input.checkpointRef, commitOid],
      });
    });
  }

  async hasCheckpointRef(input: HasCheckpointRefInput): Promise<boolean> {
    return (await resolveCommit(this.git, input.cwd, input.checkpointRef)) !== null;
  }

  async restoreCheckpoint(input: RestoreCheckpointInput): Promise<boolean> {
    let commitOid = await resolveCommit(this.git, input.cwd, input.checkpointRef);
    if (!commitOid && input.fallbackToHead) {
      commitOid = await resolveCommit(this.git, input.cwd, "HEAD");
    }
    if (!commitOid) {
      return false;
    }

    await this.git.execute({
      operation: "WorktreeCheckpoint.restore.restore",
      cwd: input.cwd,
      args: ["restore", "--source", commitOid, "--worktree", "--staged", "--", "."],
    });
    await this.git.execute({
      operation: "WorktreeCheckpoint.restore.clean",
      cwd: input.cwd,
      args: ["clean", "-fd", "--", "."],
    });
    if (await hasHeadCommit(this.git, input.cwd)) {
      await this.git.execute({
        operation: "WorktreeCheckpoint.restore.reset",
        cwd: input.cwd,
        args: ["reset", "--quiet", "--", "."],
      });
    }
    return true;
  }

  async diffCheckpoints(input: DiffCheckpointsInput): Promise<string> {
    let fromCommitOid = await resolveCommit(this.git, input.cwd, input.fromCheckpointRef);
    const toCommitOid = await resolveCommit(this.git, input.cwd, input.toCheckpointRef);
    if (!fromCommitOid && input.fallbackFromToHead) {
      fromCommitOid = await resolveCommit(this.git, input.cwd, "HEAD");
    }
    if (!fromCommitOid || !toCommitOid) {
      throw new GitCommandError({
        operation: "WorktreeCheckpoint.diffCheckpoints",
        command: "git diff",
        cwd: input.cwd,
        detail: "Checkpoint ref is unavailable for diff operation.",
      });
    }

    return (
      await this.git.execute({
        operation: "WorktreeCheckpoint.diff.diff",
        cwd: input.cwd,
        args: ["diff", "--patch", "--minimal", "--no-color", fromCommitOid, toCommitOid],
      })
    ).stdout;
  }

  async deleteCheckpointRefs(input: DeleteCheckpointRefsInput): Promise<void> {
    await Promise.all(
      input.checkpointRefs.map((checkpointRef) =>
        this.git.execute({
          operation: "WorktreeCheckpoint.deleteCheckpointRef",
          cwd: input.cwd,
          args: ["update-ref", "-d", checkpointRef],
          allowNonZeroExit: true,
        }),
      ),
    );
  }
}
