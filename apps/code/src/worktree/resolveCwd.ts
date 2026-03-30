import type { ResolveEffectiveCwdInput } from "./types";

export function resolveEffectiveCwd(input: ResolveEffectiveCwdInput): string {
  const sessionCwd = input.sessionCwd?.trim();
  if (sessionCwd) {
    return sessionCwd;
  }

  const worktreePath = input.worktreePath?.trim();
  if (worktreePath) {
    return worktreePath;
  }

  return input.repoRoot;
}
