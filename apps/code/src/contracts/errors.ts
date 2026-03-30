export class LunaError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "LunaError";
	}
}

export class LunaConfigurationError extends LunaError {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "LunaConfigurationError";
	}
}

export class LunaWorktreeError extends LunaError {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "LunaWorktreeError";
	}
}

export class LunaSessionError extends LunaError {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "LunaSessionError";
	}
}

export class LunaStorageError extends LunaError {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "LunaStorageError";
	}
}
