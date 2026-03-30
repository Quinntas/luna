import type { ProviderInteractionMode } from "./typesCore";

export const CODEX_DEFAULT_MODEL = "gpt-5.3-codex";

export function buildCodexCollaborationMode(input: {
	readonly interactionMode?: "default" | "plan";
	readonly model?: string;
	readonly effort?: string;
	readonly defaultInstructions: string;
	readonly planInstructions: string;
}):
	| {
			mode: "default" | "plan";
			settings: {
				model: string;
				reasoning_effort: string;
				developer_instructions: string;
			};
	  }
	| undefined {
	if (input.interactionMode === undefined) {
		return undefined;
	}

	const model = input.model ?? CODEX_DEFAULT_MODEL;
	return {
		mode: input.interactionMode,
		settings: {
			model,
			reasoning_effort: input.effort ?? "medium",
			developer_instructions:
				input.interactionMode === "plan" ? input.planInstructions : input.defaultInstructions,
		},
	};
}

export function buildTurnInput(input: {
	readonly text?: string;
	readonly attachments?: ReadonlyArray<{ type: "image"; url: string }>;
}): Array<{ type: "text"; text: string; text_elements: [] } | { type: "image"; url: string }> {
	const turnInput: Array<
		{ type: "text"; text: string; text_elements: [] } | { type: "image"; url: string }
	> = [];

	if (input.text) {
		turnInput.push({
			type: "text",
			text: input.text,
			text_elements: [],
		});
	}

	for (const attachment of input.attachments ?? []) {
		if (attachment.type === "image") {
			turnInput.push({
				type: "image",
				url: attachment.url,
			});
		}
	}

	return turnInput;
}

export function buildTurnStartParams(input: {
	readonly providerThreadId: string;
	readonly turnInput: Array<
		{ type: "text"; text: string; text_elements: [] } | { type: "image"; url: string }
	>;
	readonly model?: string;
	readonly serviceTier?: string | null;
	readonly effort?: string;
	readonly interactionMode?: ProviderInteractionMode;
	readonly defaultInstructions: string;
	readonly planInstructions: string;
}) {
	const params: {
		threadId: string;
		input: Array<
			{ type: "text"; text: string; text_elements: [] } | { type: "image"; url: string }
		>;
		model?: string;
		serviceTier?: string | null;
		effort?: string;
		collaborationMode?: {
			mode: "default" | "plan";
			settings: {
				model: string;
				reasoning_effort: string;
				developer_instructions: string;
			};
		};
	} = {
		threadId: input.providerThreadId,
		input: input.turnInput,
	};

	if (input.model) {
		params.model = input.model;
	}
	if (input.serviceTier !== undefined) {
		params.serviceTier = input.serviceTier;
	}
	if (input.effort) {
		params.effort = input.effort;
	}

	const collaborationMode = buildCodexCollaborationMode({
		interactionMode: input.interactionMode,
		model: input.model,
		effort: input.effort,
		defaultInstructions: input.defaultInstructions,
		planInstructions: input.planInstructions,
	});
	if (collaborationMode) {
		if (!params.model) {
			params.model = collaborationMode.settings.model;
		}
		params.collaborationMode = collaborationMode;
	}

	return params;
}
