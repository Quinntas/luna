import { reflexionCritiquePrompt } from "@luna/prompts";
import { generateText, type LanguageModel } from "ai";

export interface ReflexionResult {
	attempts: ReflexionAttempt[];
	finalAnswer: string;
	succeeded: boolean;
}

export interface ReflexionAttempt {
	answer: string;
	feedback: string;
	reflection: string;
}

export async function reflexionAgent(
	query: string,
	model: LanguageModel,
	execute: (query: string, reflection?: string) => Promise<{ answer: string; feedback: string }>,
	maxAttempts = 3,
): Promise<ReflexionResult> {
	const attempts: ReflexionAttempt[] = [];

	for (let i = 0; i < maxAttempts; i++) {
		const context =
			i > 0 ? `${query}\n\nPrevious reflection: ${attempts[i - 1]?.reflection}` : query;

		const { answer, feedback } = await execute(context);

		if (feedback === "success") {
			return { attempts, finalAnswer: answer, succeeded: true };
		}

		const { text: reflection } = await generateText({
			model,
			prompt: reflexionCritiquePrompt(query, answer, feedback),
		});

		attempts.push({ answer, feedback, reflection: reflection.trim() });
	}

	return {
		attempts,
		finalAnswer: attempts[attempts.length - 1]?.answer ?? "No answer produced.",
		succeeded: false,
	};
}
