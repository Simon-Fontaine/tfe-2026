import { describe, expect, test } from "bun:test";
import { canAssignOrgRole, canManageOrg } from "@scrimflow/shared";

describe("organization staff role boundaries", () => {
	test("keeps owner-only authority for assigning admins", () => {
		expect(canAssignOrgRole("owner", "admin")).toBe(true);
		expect(canAssignOrgRole("owner", "member")).toBe(true);
		expect(canAssignOrgRole("admin", "admin")).toBe(false);
		expect(canAssignOrgRole("admin", "member")).toBe(true);
		expect(canAssignOrgRole("member", "member")).toBe(false);
		expect(canAssignOrgRole(null, "member")).toBe(false);
	});

	test("treats only owners and admins as organization managers", () => {
		expect(canManageOrg("owner")).toBe(true);
		expect(canManageOrg("admin")).toBe(true);
		expect(canManageOrg("member")).toBe(false);
		expect(canManageOrg(null)).toBe(false);
	});
});
