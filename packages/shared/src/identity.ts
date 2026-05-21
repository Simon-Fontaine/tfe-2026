const RESERVED_IDENTITY_VALUES = new Set([
	"account",
	"admin",
	"api",
	"app",
	"auth",
	"brand",
	"contact",
	"dashboard",
	"help",
	"home",
	"login",
	"logout",
	"moderation",
	"new",
	"org",
	"orgs",
	"organization",
	"organizations",
	"player",
	"players",
	"privacy",
	"profile",
	"recruiting",
	"register",
	"root",
	"scrim",
	"scrims",
	"security",
	"settings",
	"staff",
	"support",
	"team",
	"teams",
	"terms",
	"updates",
]);

export function normalizeIdentityValue(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

export function isReservedIdentityValue(value: string): boolean {
	const normalized = normalizeIdentityValue(value);
	return normalized.length === 0 || RESERVED_IDENTITY_VALUES.has(normalized);
}
