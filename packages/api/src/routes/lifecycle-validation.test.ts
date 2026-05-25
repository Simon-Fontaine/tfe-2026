import { describe, expect, test } from "bun:test";
import {
	LifecycleArchiveSchema,
	LifecycleDeletionRequestSchema,
	LifecycleRestoreSchema,
} from "@scrimflow/shared";
import * as v from "valibot";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";

describe("lifecycle validation schemas", () => {
	test("accepts explicit archive and restore requests", () => {
		expect(
			v.safeParse(LifecycleArchiveSchema, {
				entityType: "team",
				entityId: TEAM_ID,
				reason: "Season ended",
			}).success
		).toBe(true);
		expect(
			v.safeParse(LifecycleRestoreSchema, {
				entityType: "organization",
				entityId: TEAM_ID,
			}).success
		).toBe(true);
	});

	test("rejects opaque destructive lifecycle payloads", () => {
		const parsed = v.safeParse(LifecycleDeletionRequestSchema, {
			entityType: "team",
			entityId: TEAM_ID,
			confirmName: "",
			retentionPolicy: "drop_everything",
			unexpected: true,
		});

		expect(parsed.success).toBe(false);
	});

	test("accepts deletion-pending requests with approved retention policy", () => {
		const parsed = v.safeParse(LifecycleDeletionRequestSchema, {
			entityType: "organization",
			entityId: TEAM_ID,
			confirmName: "Example Org",
			reason: "Owner requested closure",
			retentionPolicy: "archive_all_teams",
		});

		expect(parsed.success).toBe(true);
	});
});
