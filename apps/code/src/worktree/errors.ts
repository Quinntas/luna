export class GitRuntimeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "GitRuntimeError";
  }
}

export class GitCommandError extends GitRuntimeError {
  readonly operation: string;
  readonly command: string;
  readonly cwd: string;
  readonly detail: string;

  constructor(input: {
    operation: string;
    command: string;
    cwd: string;
    detail: string;
    cause?: unknown;
  }) {
    super(`${input.detail} (${input.command} in ${input.cwd})`, { cause: input.cause });
    this.name = "GitCommandError";
    this.operation = input.operation;
    this.command = input.command;
    this.cwd = input.cwd;
    this.detail = input.detail;
  }
}
