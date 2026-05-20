import { describe, expect, test } from "bun:test";
import { getTeamIdentityFieldErrors, normalizeTeamIdentity } from "./identity";

describe("team identity helpers", () => {
	test("normalizes team identity before persistence and comparison", () => {
		expect(normalizeTeamIdentity({ name: "  Main Roster  ", tag: " sf " })).toEqual({
			name: "Main Roster",
			tag: "SF",
		});
	});

	test("returns field-scoped conflict messages for org-scoped active team collisions", () => {
		const fieldErrors = getTeamIdentityFieldErrors(
			{ name: "Main Roster", tag: "SF" },
			{ name: "main roster", tag: "sf" }
		);

		expect(fieldErrors).toEqual({
			name: ["Another active team in this organization already uses this name."],
			tag: ["Another active team in this organization already uses this tag."],
		});
	});

	test("merges field errors when name and tag collide with different teams", () => {
		const fieldErrors = getTeamIdentityFieldErrors({ name: "Main Roster", tag: "SF" }, [
			{ name: "main roster", tag: "MR" },
			{ name: "Academy", tag: "sf" },
		]);

		expect(fieldErrors).toEqual({
			name: ["Another active team in this organization already uses this name."],
			tag: ["Another active team in this organization already uses this tag."],
		});
	});
});
