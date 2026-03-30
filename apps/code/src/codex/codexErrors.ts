export class CodexRuntimeError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "CodexRuntimeError";
	}
}

export class CodexRequestError extends CodexRuntimeError {
	readonly method: string;

	constructor(method: string, message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "CodexRequestError";
		this.method = method;
	}
}
