import { describe, expect, test } from "bun:test";
import { getOwnershipStatusCopy, isOpenOwnershipStatus } from "./ownership";

describe("ownership workflow helpers", () => {
	test("treats only pending transfers as open workflows", () => {
		expect(isOpenOwnershipStatus("pending")).toBe(true);
		expect(isOpenOwnershipStatus("accepted")).toBe(false);
		expect(isOpenOwnershipStatus("cancelled")).toBe(false);
		expect(isOpenOwnershipStatus("rejected")).toBe(false);
	});

	test("returns textual state copy for workspace surfaces", () => {
		expect(getOwnershipStatusCopy("pending")).toBe("Pending recipient verification");
		expect(getOwnershipStatusCopy("accepted")).toBe("Accepted and settling");
		expect(getOwnershipStatusCopy("cancelled")).toBe("Cancelled");
	});
});
