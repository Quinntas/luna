import { z } from "zod";
import type { ToolDefinition } from "../types.ts";

const searchWebSchema = z.object({
	query: z.string().describe("The search query"),
	maxResults: z.number().optional().describe("Maximum number of results (default 5)"),
});

const discoverTopicSchema = z.object({
	topic: z
		.string()
		.optional()
		.describe("A specific topic to look up (e.g. 'space', 'history', 'gaming')"),
});

type SearchWebInput = z.infer<typeof searchWebSchema>;
type DiscoverTopicInput = z.infer<typeof discoverTopicSchema>;

interface WikiSearchResult {
	title: string;
	pageid: number;
	snippet: string;
}

interface WikiPage {
	title: string;
	extract: string;
	content_urls?: {
		desktop: { page: string };
	};
}

async function searchWikipedia(query: string, maxResults: number): Promise<string[]> {
	const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=${maxResults}`;
	const searchRes = await fetch(searchUrl, {
		headers: { "User-Agent": "LunaAgent/1.0" },
	});
	const searchData = (await searchRes.json()) as {
		query?: { search?: WikiSearchResult[] };
	};

	const items = searchData.query?.search ?? [];
	if (items.length === 0) return [];

	const titles = items.map((i) => i.title);
	const summaryUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles.join("|"))}&prop=extracts|info&exintro=1&explaintext=1&inprop=url&format=json`;
	const summaryRes = await fetch(summaryUrl, {
		headers: { "User-Agent": "LunaAgent/1.0" },
	});
	const summaryData = (await summaryRes.json()) as {
		query?: { pages?: Record<string, WikiPage> };
	};

	const pages = summaryData.query?.pages ?? {};
	const results: string[] = [];

	for (const [_id, page] of Object.entries(pages)) {
		if (!page.extract) continue;
		const url = page.content_urls?.desktop?.page ?? "";
		const snippet = page.extract.split("\n")[0]?.slice(0, 300) ?? "";
		results.push(`[${url}] ${page.title}: ${snippet}`);
	}

	return results;
}

async function searchDDG(query: string, maxResults: number): Promise<string[]> {
	const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
	const response = await fetch(url);
	const data = (await response.json()) as {
		AbstractText: string;
		AbstractURL: string;
		RelatedTopics: Array<{ Text: string; FirstURL: string }>;
	};

	const results: string[] = [];

	if (data.AbstractText) {
		results.push(`[Source: ${data.AbstractURL || "DuckDuckGo"}] ${data.AbstractText}`);
	}

	for (const topic of (data.RelatedTopics ?? []).slice(0, maxResults)) {
		if (topic.Text) {
			results.push(`[${topic.FirstURL || ""}] ${topic.Text}`);
		}
	}

	return results;
}

export const searchWebTool: ToolDefinition<SearchWebInput> = {
	name: "search_web",
	description:
		"Search the web for information. Searches Wikipedia first, then falls back to DuckDuckGo. Returns results with titles, URLs, and snippets.",
	schema: searchWebSchema,
	execute: async ({ query, maxResults = 5 }) => {
		try {
			const wikiResults = await searchWikipedia(query, maxResults);
			if (wikiResults.length > 0) {
				return wikiResults.join("\n\n");
			}
		} catch {
			// Wikipedia failed, try DDG
		}

		try {
			const ddgResults = await searchDDG(query, maxResults);
			if (ddgResults.length > 0) {
				return ddgResults.join("\n\n");
			}
		} catch {
			// DDG also failed
		}

		return "No results found for that query.";
	},
	tags: ["web", "search", "internet", "lookup"],
};

export const discoverInterestingTopicTool: ToolDefinition<DiscoverTopicInput> = {
	name: "discover_interesting_topic",
	description:
		"Find interesting facts, news, or topics to talk about. Uses user preferences if no specific topic is provided.",
	schema: discoverTopicSchema,
	execute: async ({ topic }) => {
		try {
			// Get user topics if none provided
			let searchTopic = topic;
			if (!searchTopic) {
				const { getPreferences } = await import("@luna/personalize");
				const prefs = getPreferences();
				const savedTopics = (prefs.topics as string[]) ?? [];

				if (savedTopics.length > 0) {
					// Pick a random saved topic
					searchTopic = savedTopics[Math.floor(Math.random() * savedTopics.length)];
				} else {
					// Fallback topics
					const fallbacks = ["todayilearned", "space", "technology", "Showerthoughts"];
					searchTopic = fallbacks[Math.floor(Math.random() * fallbacks.length)];
				}
			}

			// Ensure we have a string
			const finalTopic = searchTopic ?? "todayilearned";

			// Map topics to subreddits (simple heuristic)
			let subreddit = finalTopic.toLowerCase().replace(/[^a-z0-9]/g, "");
			if (subreddit === "random" || subreddit === "interesting") subreddit = "todayilearned";
			if (subreddit === "tech") subreddit = "technology";
			if (subreddit === "games") subreddit = "gaming";

			const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=10`;
			const response = await fetch(url, {
				headers: { "User-Agent": "LunaAgent/1.0" },
			});

			if (!response.ok) {
				return await searchWikipedia(`interesting facts about ${finalTopic}`, 3).then((res) =>
					res.length > 0 ? res.join("\n\n") : "Couldn't find anything interesting right now.",
				);
			}

			const data = (await response.json()) as {
				data?: { children?: Array<{ data?: { title?: string; ups?: number } }> };
			};

			const posts = data.data?.children ?? [];
			const titles = posts
				.map((p) => p.data?.title)
				.filter((t): t is string => !!t && !t.includes("megathread") && !t.includes("Megathread"))
				.slice(0, 5);

			if (titles.length === 0) {
				return `Found nothing interesting in ${finalTopic}.`;
			}

			return `Here are some interesting things from r/${subreddit}:\n- ` + titles.join("\n- ");
		} catch (err) {
			return `Failed to discover topic: ${err instanceof Error ? err.message : String(err)}`;
		}
	},
	tags: ["fun", "interesting", "reddit", "facts", "news"],
};
