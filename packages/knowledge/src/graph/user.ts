import type { UserProfile } from "../types.ts";
import { getDriver } from "./client.ts";

export async function getProfile(): Promise<UserProfile | null> {
	const driver = getDriver();
	const session = driver.session();

	try {
		const result = await session.run(
			`MATCH (u:Entity {id: "user_profile", type: "User"}) RETURN u LIMIT 1`,
		);

		if (result.records.length === 0) return null;

		const props = result.records[0]?.get("u").properties;
		return {
			id: props.id as string,
			name: props.name as string,
			preferences:
				typeof props.preferences === "string" ? JSON.parse(props.preferences as string) : {},
			writingStyle:
				typeof props.writingStyle === "string"
					? JSON.parse(props.writingStyle as string)
					: { formality: "neutral", avgSentenceLength: 15, commonTerms: [] },
			topics: (props.topics as string[]) ?? [],
			updatedAt: props.updatedAt as string,
		};
	} finally {
		await session.close();
	}
}

export async function updateProfile(
	updates: Partial<Pick<UserProfile, "preferences" | "writingStyle" | "topics">>,
): Promise<void> {
	const driver = getDriver();
	const session = driver.session();
	const now = new Date().toISOString();

	const existing = await getProfile();
	const mergedPrefs = { ...existing?.preferences, ...updates.preferences };
	const mergedStyle = { ...existing?.writingStyle, ...updates.writingStyle };
	const mergedTopics = updates.topics ?? existing?.topics ?? [];

	try {
		await session.run(
			`MERGE (u:Entity {id: "user_profile"})
			 ON CREATE SET
			   u.name = "User",
			   u.type = "User",
			   u.aliases = [],
			   u.confidence = 1.0,
			   u.properties = "{}",
			   u.sources = "[]",
			   u.preferences = $preferences,
			   u.writingStyle = $writingStyle,
			   u.topics = $topics,
			   u.createdAt = $now,
			   u.updatedAt = $now
			 ON MATCH SET
			   u.preferences = $preferences,
			   u.writingStyle = $writingStyle,
			   u.topics = $topics,
			   u.updatedAt = $now`,
			{
				preferences: JSON.stringify(mergedPrefs),
				writingStyle: JSON.stringify(mergedStyle),
				topics: mergedTopics,
				now,
			},
		);
	} finally {
		await session.close();
	}
}

export function analyzeWritingStyle(samples: string[]): UserProfile["writingStyle"] {
	let totalLength = 0;
	let totalSentences = 0;
	const termFreq = new Map<string, number>();

	for (const sample of samples) {
		const sentences = sample.match(/[^.!?]+[.!?]+/g) ?? [sample];
		totalSentences += sentences.length;

		for (const sentence of sentences) {
			totalLength += sentence.trim().split(/\s+/).length;
		}

		const words = sample.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? [];
		for (const word of words) {
			termFreq.set(word, (termFreq.get(word) ?? 0) + 1);
		}
	}

	const avgSentenceLength = totalSentences > 0 ? Math.round(totalLength / totalSentences) : 15;

	const commonTerms = [...termFreq.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 20)
		.map(([term]) => term);

	return {
		formality: avgSentenceLength > 20 ? "formal" : avgSentenceLength < 12 ? "casual" : "neutral",
		avgSentenceLength,
		commonTerms,
	};
}
