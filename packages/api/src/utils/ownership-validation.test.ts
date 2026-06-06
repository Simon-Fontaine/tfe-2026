import { describe, expect, test } from "bun:test";
import {
	CancelOwnershipWorkflowSchema,
	InitiateOwnershipTransferSchema,
	RequestOwnershipTransferCodeSchema,
	RespondToOwnershipWorkflowSchema,
} from "@scrimflow/shared";
import * as v from "valibot";

const uuid = "00000000-0000-4000-8000-000000000001";
const otherUuid = "00000000-0000-4000-8000-000000000002";

describe("ownership transfer validation", () => {
	test("request-code requires a recipient", () => {
		const parsed = v.safeParse(RequestOwnershipTransferCodeSchema, {
			entityType: "organization",
			entityId: uuid,
		});

		expect(parsed.success).toBe(false);
	});

	test("transfer initiation requires a recipient and verification code", () => {
		expect(
			v.safeParse(InitiateOwnershipTransferSchema, {
				entityType: "organization",
				entityId: uuid,
			}).success
		).toBe(false);
		expect(
			v.safeParse(InitiateOwnershipTransferSchema, {
				entityType: "organization",
				entityId: uuid,
				recipientUserId: otherUuid,
			}).success
		).toBe(false);
	});

	test("accepts a complete transfer initiation", () => {
		const parsed = v.safeParse(InitiateOwnershipTransferSchema, {
			entityType: "organization",
			entityId: uuid,
			recipientUserId: otherUuid,
			verificationCode: "123456",
			reason: "Planned handoff",
		});

		expect(parsed.success).toBe(true);
	});

	test("accepts response and cancellation bodies", () => {
		expect(
			v.safeParse(RespondToOwnershipWorkflowSchema, {
				workflowId: uuid,
				action: "accept",
			}).success
		).toBe(true);
		expect(v.safeParse(CancelOwnershipWorkflowSchema, { workflowId: uuid }).success).toBe(true);
	});
});
