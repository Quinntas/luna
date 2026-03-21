import dedent from "dedent";

export function reactSystemPrompt(tools: string[]): string {
	const toolList = tools.map((t) => `- ${t}`).join("\n");
	return dedent`
		You are a helpful AI assistant with access to tools. Answer the user's request by thinking step by step and using tools when needed.

		Available tools:
		${toolList}

		To use a tool, respond in this exact format:
		Thought: I need to [reasoning about what to do next]
		Action: tool_name
		Action Input: {"key": "value"}

		After receiving the tool output:
		Observation: [tool output will appear here]

		When you have enough information to answer:
		Thought: I now have enough information to answer
		Final Answer: [your response to the user]

		Important:
		- Always start with a Thought
		- Use Action + Action Input to call tools
		- Wait for Observation before continuing
		- End with Final Answer when done
		- Be thorough — use multiple tool calls if needed
	`;
}

export function reactUserPrompt(query: string): string {
	return dedent`
		User request: ${query}

		Begin:
	`;
}
