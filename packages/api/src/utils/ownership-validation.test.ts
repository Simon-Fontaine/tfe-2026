import { describe, expect, test } from "bun:test";
import {
	CancelOwnershipWorkflowSchema,
	InitiateOwnershipWorkflowSchema,
	ResolveOwnershipWorkflowSchema,
	RespondToOwnershipWorkflowSchema,
} from "@scrimflow/shared";
import * as v from "valibot";

const uuid = "00000000-0000-4000-8000-000000000001";
const otherUuid = "00000000-0000-4000-8000-000000000002";

describe("ownership lifecycle validation", () => {
	test("requires transfer recipients explicitly", () => {
		const parsed = v.safeParse(InitiateOwnershipWorkflowSchema, {
			entityType: "organization",
			entityId: uuid,
			kind: "transfer",
		});

		expect(parsed.success).toBe(false);
	});

	test("accepts explicit transfer initiation", () => {
		const parsed = v.safeParse(InitiateOwnershipWorkflowSchema, {
			entityType: "organization",
			entityId: uuid,
			kind: "transfer",
			recipientUserId: otherUuid,
			reason: "Planned handoff",
		});

		expect(parsed.success).toBe(true);
	});

	test("requires recovery reasons", () => {
		const parsed = v.safeParse(InitiateOwnershipWorkflowSchema, {
			entityType: "team",
			entityId: uuid,
			kind: "recovery",
		});

		expect(parsed.success).toBe(false);
	});

	test("accepts response, cancellation, and resolution bodies", () => {
		expect(
			v.safeParse(RespondToOwnershipWorkflowSchema, {
				workflowId: uuid,
				action: "accept",
			}).success
		).toBe(true);
		expect(v.safeParse(CancelOwnershipWorkflowSchema, { workflowId: uuid }).success).toBe(true);
		expect(
			v.safeParse(ResolveOwnershipWorkflowSchema, {
				workflowId: uuid,
				result: "approve",
				reason: "Verified authority",
			}).success
		).toBe(true);
	});
});
