import { describe, expect, test } from "bun:test";
import {
	getEffectiveInviteStatus,
	getRosterInviteConflictMessage,
	isActivePendingInvite,
	shouldPersistExpiredInvite,
} from "./invite-lifecycle";

describe("team invite lifecycle helpers", () => {
	test("treats pending invites past expiry as expired", () => {
		const expiredAt = new Date(Date.now() - 1000);

		expect(getEffectiveInviteStatus("pending", expiredAt)).toBe("expired");
		expect(isActivePendingInvite("pending", expiredAt)).toBe(false);
		expect(shouldPersistExpiredInvite("pending", expiredAt)).toBe(true);
	});

	test("keeps unexpired pending invites actionable", () => {
		const future = new Date(Date.now() + 1000);

		expect(getEffectiveInviteStatus("pending", future)).toBe("pending");
		expect(isActivePendingInvite("pending", future)).toBe(true);
		expect(shouldPersistExpiredInvite("pending", future)).toBe(false);
	});

	test("explains active and historical roster conflicts distinctly", () => {
		expect(getRosterInviteConflictMessage("active")).toBe(
			"This user already has an active roster relationship with this team."
		);
		expect(getRosterInviteConflictMessage("inactive")).toBe(
			"This user has a removed team membership history. Recover or update the existing roster row instead of sending a new invite."
		);
	});
});
