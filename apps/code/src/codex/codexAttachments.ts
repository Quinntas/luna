import { readFile } from "node:fs/promises";
import path from "node:path";

import type { RuntimeAttachmentInput, RuntimeImageAttachment } from "./typesCore";

const MIME_TYPES: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
};

function inferMimeType(filePath: string): string {
	const extension = path.extname(filePath).toLowerCase();
	return MIME_TYPES[extension] ?? "application/octet-stream";
}

export async function resolveRuntimeAttachment(
	attachment: RuntimeAttachmentInput,
): Promise<RuntimeImageAttachment> {
	if (attachment.type !== "image") {
		throw new Error(
			`Unsupported attachment type: ${String((attachment as { type?: unknown }).type)}`,
		);
	}

	if ("url" in attachment) {
		return { type: "image", url: attachment.url };
	}

	const bytes = await readFile(attachment.path);
	const mimeType = attachment.mimeType ?? inferMimeType(attachment.path);
	return {
		type: "image",
		url: `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`,
	};
}
