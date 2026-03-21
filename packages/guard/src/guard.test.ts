import { describe, expect, test } from "bun:test";
import { classifySensitivity } from "./classify.ts";
import { detectPII } from "./detect.ts";
import { filterInput, hasPII, redactPII } from "./redact.ts";

describe("detectPII", () => {
	test("detects SSN with dashes", () => {
		const matches = detectPII("My SSN is 123-45-6789");
		expect(matches).toHaveLength(1);
		expect(matches[0]?.type).toBe("ssn");
		expect(matches[0]?.value).toBe("123-45-6789");
	});

	test("detects SSN without dashes", () => {
		const matches = detectPII("SSN: 123456789");
		expect(matches).toHaveLength(1);
		expect(matches[0]?.type).toBe("ssn");
	});

	test("detects email", () => {
		const matches = detectPII("Contact alice@example.com for info");
		expect(matches).toHaveLength(1);
		expect(matches[0]?.type).toBe("email");
		expect(matches[0]?.value).toBe("alice@example.com");
	});

	test("detects phone number", () => {
		const matches = detectPII("Call me at 555-123-4567");
		expect(matches).toHaveLength(1);
		expect(matches[0]?.type).toBe("phone");
	});

	test("detects phone with area code parens", () => {
		const matches = detectPII("(555) 123-4567");
		expect(matches).toHaveLength(1);
		expect(matches[0]?.type).toBe("phone");
	});

	test("validates credit card with Luhn", () => {
		const matches = detectPII("Card: 4532015112830366");
		const cards = matches.filter((m) => m.type === "credit_card");
		expect(cards).toHaveLength(1);
		expect(cards[0]?.type).toBe("credit_card");
	});

	test("rejects invalid credit card (fails Luhn)", () => {
		const matches = detectPII("Card: 1234567890123456");
		const cards = matches.filter((m) => m.type === "credit_card");
		expect(cards).toHaveLength(0);
	});

	test("detects IP address", () => {
		const matches = detectPII("Server at 192.168.1.1");
		expect(matches).toHaveLength(1);
		expect(matches[0]?.type).toBe("ip_address");
	});

	test("rejects invalid IP (>255)", () => {
		const matches = detectPII("Invalid: 999.999.999.999");
		const ips = matches.filter((m) => m.type === "ip_address");
		expect(ips).toHaveLength(0);
	});

	test("detects DOB", () => {
		const matches = detectPII("DOB: 01/15/1990");
		expect(matches).toHaveLength(1);
		expect(matches[0]?.type).toBe("date_of_birth");
	});

	test("returns empty for clean text", () => {
		const matches = detectPII("This is just normal text about nothing.");
		expect(matches).toHaveLength(0);
	});

	test("detects multiple PII types", () => {
		const text = "Email alice@test.com or call 555-123-4567. SSN: 123-45-6789";
		const matches = detectPII(text);
		expect(matches.length).toBeGreaterThanOrEqual(3);
		const types = new Set(matches.map((m) => m.type));
		expect(types.has("email")).toBe(true);
		expect(types.has("phone")).toBe(true);
		expect(types.has("ssn")).toBe(true);
	});

	test("filters by type", () => {
		const text = "Email alice@test.com SSN 123-45-6789";
		const emails = detectPII(text, ["email"]);
		expect(emails).toHaveLength(1);
		expect(emails[0]?.type).toBe("email");
	});

	test("returns correct positions", () => {
		const matches = detectPII("SSN: 123-45-6789 here");
		expect(matches[0]?.start).toBe(5);
		expect(matches[0]?.end).toBe(16);
	});
});

describe("redactPII", () => {
	test("redacts SSN", () => {
		const result = redactPII("SSN is 123-45-6789");
		expect(result.text).toBe("SSN is [REDACTED]");
		expect(result.matches).toHaveLength(1);
	});

	test("uses custom redaction string", () => {
		const result = redactPII("Email alice@test.com", { redactWith: "***" });
		expect(result.text).toBe("Email ***");
	});

	test("returns original if no PII", () => {
		const result = redactPII("Clean text");
		expect(result.text).toBe("Clean text");
		expect(result.matches).toHaveLength(0);
	});

	test("preserves text around redaction", () => {
		const result = redactPII("Contact alice@test.com for help");
		expect(result.text).toContain("Contact");
		expect(result.text).toContain("for help");
		expect(result.text).toContain("[REDACTED]");
	});
});

describe("hasPII", () => {
	test("returns true for text with PII", () => {
		expect(hasPII("SSN: 123-45-6789")).toBe(true);
	});

	test("returns false for clean text", () => {
		expect(hasPII("No PII here")).toBe(false);
	});
});

describe("filterInput", () => {
	test("filterInput redacts PII", () => {
		const result = filterInput("My SSN is 123-45-6789");
		expect(result).toBe("My SSN is [REDACTED]");
	});
});

describe("classifySensitivity", () => {
	test("detects restricted (health)", () => {
		expect(classifySensitivity("My health records show...")).toBe("restricted");
	});

	test("detects restricted (SSN)", () => {
		expect(classifySensitivity("Enter your SSN")).toBe("restricted");
	});

	test("detects confidential (salary)", () => {
		expect(classifySensitivity("My salary is $100k")).toBe("confidential");
	});

	test("detects confidential (contract)", () => {
		expect(classifySensitivity("Sign the NDA contract")).toBe("confidential");
	});

	test("detects internal (meeting notes)", () => {
		expect(classifySensitivity("Meeting notes from sprint planning")).toBe("internal");
	});

	test("returns public for generic text", () => {
		expect(classifySensitivity("The weather is nice today")).toBe("public");
	});

	test("picks highest sensitivity", () => {
		expect(classifySensitivity("Health and meeting notes")).toBe("restricted");
	});
});
