import { LunaRuntime, SqliteThreadStore } from "../index.ts";
import { formatDuration, formatStructuredMarkdown, formatTokenUsage } from "./format.ts";
import { addAgentMessage } from "./messages.ts";
import { SPINNER_FRAMES, theme } from "./theme.ts";
import type { TuiRefs, TuiState } from "./types.ts";

export function createRuntime(dbPath: string | undefined): LunaRuntime {
	return new LunaRuntime({ store: new SqliteThreadStore({ dbPath }) });
}

export function updateMetaText(state: TuiState, refs: TuiRefs, model: string): void {
	const elapsed =
		state.activeTurnStartedAtMs !== null
			? Date.now() - state.activeTurnStartedAtMs
			: state.lastTurnDurationMs;
	refs.metaText.content =
		elapsed === null ? `  ${model}` : `  ${model}  ·  ${formatDuration(elapsed)}`;
}

export function updateTokenText(state: TuiState, refs: TuiRefs): void {
	refs.tokenText.content = formatTokenUsage(state.latestTokenUsage);
}

export function startSpinner(state: TuiState, refs: TuiRefs, label: string, model: string): void {
	refs.statusText.content = label === "thinking" ? `${SPINNER_FRAMES[0]} thinking` : "";
	state.spinnerTimer = setInterval(() => {
		if (label === "thinking") {
			refs.statusText.content = `${SPINNER_FRAMES[state.spinnerIdx++ % SPINNER_FRAMES.length]} thinking`;
		}
		updateMetaText(state, refs, model);
	}, 80);
}

export function stopSpinner(state: TuiState, refs: TuiRefs): void {
	if (state.spinnerTimer !== undefined) {
		clearInterval(state.spinnerTimer);
		state.spinnerTimer = undefined;
	}
	refs.statusText.content = "";
}

export function finishTurn(
	state: TuiState,
	refs: TuiRefs,
	model: string,
	statusColor?: string,
): void {
	if (state.activeTurnStartedAtMs !== null) {
		state.lastTurnDurationMs = Math.max(0, Date.now() - state.activeTurnStartedAtMs);
		state.activeTurnStartedAtMs = null;
		updateMetaText(state, refs, model);
	}
	if (state.currentResponse) {
		state.currentResponse.content = formatStructuredMarkdown(state.currentResponse.content);
		state.currentResponse.streaming = false;
		state.currentResponse = null;
	}
	stopSpinner(state, refs);
	refs.statusText.fg = statusColor ?? theme.muted;
	state.inputEnabled = true;
	refs.input.focus();
}

export function wireRuntime(
	runtime: LunaRuntime,
	state: TuiState,
	refs: TuiRefs,
	model: string,
): void {
	runtime.on((event) => {
		if (event.type === "turn.started") {
			state.activeTurnStartedAtMs = Date.now();
			updateMetaText(state, refs, model);
			return;
		}
		if (event.type === "content.delta") {
			state.currentResponse ??= addAgentMessage(refs);
			state.currentResponse.content += event.payload.delta;
			return;
		}
		if (event.type === "thread.token-usage.updated") {
			state.latestTokenUsage = event.payload.usage;
			updateTokenText(state, refs);
			return;
		}
		if (event.type === "turn.completed") {
			finishTurn(state, refs, model);
			return;
		}
		if (event.type === "turn.aborted") {
			finishTurn(state, refs, model, theme.yellow);
			return;
		}
		if (event.type === "session.error") {
			finishTurn(state, refs, model, theme.red);
			return;
		}
		if (event.type === "session.exited") {
			state.activeTurnStartedAtMs = null;
			updateMetaText(state, refs, model);
			if (state.currentResponse) {
				state.currentResponse.streaming = false;
				state.currentResponse = null;
			}
			stopSpinner(state, refs);
			refs.statusText.fg = theme.muted;
			state.inputEnabled = false;
		}
	});
}
