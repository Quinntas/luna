import type { ThreadTokenUsageSnapshot } from "../codex/typesCore";

export function formatStructuredMarkdown(content: string): string {
	const trimmed = content.trim();
	if (!trimmed || !["{", "["].includes(trimmed[0] ?? "")) {
		return content;
	}

	try {
		const parsed = JSON.parse(trimmed);
		return `\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
	} catch {
		return content;
	}
}

export function formatDuration(ms: number | null): string {
	if (ms === null || ms < 0) {
		return "--";
	}
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) {
		return `${hours}h ${minutes}m ${seconds}s`;
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}
	if (seconds > 0) {
		return `${seconds}s`;
	}
	return `${ms}ms`;
}

export function formatCompactNumber(value: number): string {
	if (value >= 1_000_000) {
		return `${(value / 1_000_000).toFixed(1)}m`;
	}
	if (value >= 1_000) {
		return `${(value / 1_000).toFixed(1)}k`;
	}
	return `${value}`;
}

export function formatTokenUsage(usage: ThreadTokenUsageSnapshot | null): string {
	if (!usage) {
		return "0 (0%)";
	}
	const used = usage.usedTokens;
	const max = usage.maxTokens;
	if (!max || max <= 0) {
		return formatCompactNumber(used);
	}
	const percentage = Math.max(0, Math.min(100, Math.round((used / max) * 100)));
	return `${formatCompactNumber(used)} (${percentage}%)`;
}

export function getSlashQuery(text: string): string | null {
	const trimmed = text.trim();
	if (!trimmed.startsWith("/") || /\s/.test(trimmed)) {
		return null;
	}
	return trimmed.slice(1);
}
