export interface PIIMatch {
	type: PIIType;
	value: string;
	start: number;
	end: number;
}

export type PIIType = "ssn" | "email" | "phone" | "credit_card" | "ip_address" | "date_of_birth";

export interface GuardOptions {
	types?: PIIType[];
	redactWith?: string;
}

export type SensitivityLevel = "public" | "internal" | "confidential" | "restricted";
