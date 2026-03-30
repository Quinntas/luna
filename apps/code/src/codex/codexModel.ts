export type CodexPlanType =
	| "free"
	| "go"
	| "plus"
	| "pro"
	| "team"
	| "business"
	| "enterprise"
	| "edu"
	| "unknown";

export interface CodexAccountSnapshot {
	readonly type: "apiKey" | "chatgpt" | "unknown";
	readonly planType: CodexPlanType | null;
	readonly sparkEnabled: boolean;
}

const CODEX_DEFAULT_MODEL = "gpt-5.3-codex";
const CODEX_SPARK_MODEL = "gpt-5.3-codex-spark";
const CODEX_SPARK_DISABLED_PLAN_TYPES = new Set<CodexPlanType>(["free", "go", "plus"]);

const CODEX_MODEL_ALIASES: Record<string, string> = {
	"5.3": "gpt-5.3-codex",
	"gpt-5.3": "gpt-5.3-codex",
	"5.4": "gpt-5.4",
	"gpt-5.4": "gpt-5.4",
	"5.4-mini": "gpt-5.4-mini",
	"gpt-5.4-mini": "gpt-5.4-mini",
};

function asObject(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

export function normalizeModelSlug(model: string | undefined | null): string | null {
	if (typeof model !== "string") {
		return null;
	}

	const trimmed = model.trim();
	if (!trimmed) {
		return null;
	}

	return CODEX_MODEL_ALIASES[trimmed] ?? trimmed;
}

export function normalizeCodexModelSlug(
	model: string | undefined | null,
	preferredId?: string,
): string | undefined {
	const normalized = normalizeModelSlug(model);
	if (!normalized) {
		return undefined;
	}

	if (preferredId?.endsWith("-codex") && preferredId !== normalized) {
		return preferredId;
	}

	return normalized;
}

export function readCodexAccountSnapshot(response: unknown): CodexAccountSnapshot {
	const record = asObject(response);
	const account = asObject(record?.account) ?? record;
	const accountType = asString(account?.type);

	if (accountType === "apiKey") {
		return {
			type: "apiKey",
			planType: null,
			sparkEnabled: true,
		};
	}

	if (accountType === "chatgpt") {
		const rawPlanType = account?.planType;
		const planType = typeof rawPlanType === "string" ? (rawPlanType as CodexPlanType) : "unknown";
		return {
			type: "chatgpt",
			planType,
			sparkEnabled: !CODEX_SPARK_DISABLED_PLAN_TYPES.has(planType),
		};
	}

	return {
		type: "unknown",
		planType: null,
		sparkEnabled: true,
	};
}

export function resolveCodexModelForAccount(
	model: string | undefined,
	account: CodexAccountSnapshot,
): string | undefined {
	if (model !== CODEX_SPARK_MODEL || account.sparkEnabled) {
		return model;
	}

	return CODEX_DEFAULT_MODEL;
}
