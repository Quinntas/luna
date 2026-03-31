export const theme = {
	text: "#cdd6f4",
	subtext: "#a6adc8",
	muted: "#585b70",
	surface: "#1e1e2e",
	border: "#45475a",
	mauve: "#cba6f7",
	sky: "#89dceb",
	red: "#f38ba8",
	yellow: "#f9e2af",
	green: "#a6e3a1",
};

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
export const SCROLL_STEP = 3;
export const REASONING_EFFORTS = ["low", "medium", "high"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export const SIDEBAR_CONFIG = {
	maxThreadsPerProject: 10,
	widthChars: 40,
} as const;
