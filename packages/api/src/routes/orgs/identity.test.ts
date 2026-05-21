import { describe, expect, test } from "bun:test";
import {
	CreateOrgSchema,
	isReservedIdentityValue,
	normalizeIdentityValue,
} from "@scrimflow/shared";
import * as v from "valibot";

describe("organization identity helpers", () => {
	test("normalizes public identity values to slug-safe form", () => {
		expect(normalizeIdentityValue("  Team Liquid OW2  ")).toBe("team-liquid-ow2");
		expect(normalizeIdentityValue("ScrimFlow!!!Admin")).toBe("scrimflow-admin");
	});

	test("blocks reserved public route identities", () => {
		expect(isReservedIdentityValue("Admin")).toBe(true);
		expect(isReservedIdentityValue("orgs")).toBe(true);
		expect(isReservedIdentityValue("Team Liquid")).toBe(false);
	});

	test("allows blank optional slug and derives it server-side", () => {
		const parsed = v.safeParse(CreateOrgSchema, {
			name: "Team Liquid",
			slug: "",
			website: "",
			discord: "",
			twitter: "",
			isPublic: true,
		});

		expect(parsed.success).toBe(true);
	});

	test("rejects unsafe public organization links", () => {
		const parsed = v.safeParse(CreateOrgSchema, {
			name: "Team Liquid",
			website: "javascript:alert(1)",
			discord: "discord.gg/team-liquid",
			twitter: "@teamliquid",
		});

		expect(parsed.success).toBe(false);
		expect(parsed.issues?.map((issue) => issue.path?.[0]?.key)).toContain("website");
		expect(parsed.issues?.map((issue) => issue.path?.[0]?.key)).toContain("discord");
		expect(parsed.issues?.map((issue) => issue.path?.[0]?.key)).toContain("twitter");
	});
});
