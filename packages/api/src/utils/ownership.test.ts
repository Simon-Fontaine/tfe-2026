import { describe, expect, test } from "bun:test";
import { getOwnershipStatusCopy, isOpenOwnershipStatus } from "./ownership";

describe("ownership workflow helpers", () => {
	test("treats pending and review states as canonical open workflows", () => {
		expect(isOpenOwnershipStatus("pending")).toBe(true);
		expect(isOpenOwnershipStatus("review_required")).toBe(true);
		expect(isOpenOwnershipStatus("accepted")).toBe(false);
		expect(isOpenOwnershipStatus("cancelled")).toBe(false);
	});

	test("returns textual state copy for workspace surfaces", () => {
		expect(getOwnershipStatusCopy("pending")).toBe("Pending recipient verification");
		expect(getOwnershipStatusCopy("review_required")).toBe("Recovery review required");
		expect(getOwnershipStatusCopy("blocked")).toBe("Blocked by continuity policy");
	});
});
