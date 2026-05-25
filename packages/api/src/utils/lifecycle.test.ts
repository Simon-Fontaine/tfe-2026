import { describe, expect, test } from "bun:test";

describe("lifecycle policy helpers", () => {
	test("maps archive and deletion-pending states to visibility impacts", async () => {
		process.env.DATABASE_URL ??= "postgres://localhost/scrimflow_test";
		const { lifecycleVisibilityImpact } = await import("./lifecycle");

		expect(lifecycleVisibilityImpact("active")).toEqual([]);
		expect(lifecycleVisibilityImpact("archived")).toContain("active_workflows_suspended");
		expect(lifecycleVisibilityImpact("archived")).toContain("history_preserved");
		expect(lifecycleVisibilityImpact("deletion_pending")).toContain("workspace_read_only");
		expect(lifecycleVisibilityImpact("irreversible")).toContain("public_hidden");
	});

	test("allows deletion cancellation only inside the recovery window", async () => {
		process.env.DATABASE_URL ??= "postgres://localhost/scrimflow_test";
		const { canCancelLifecycle, getLifecycleMutationBlockReason } = await import("./lifecycle");
		const future = new Date(Date.now() + 60_000);
		const past = new Date(Date.now() - 60_000);

		expect(canCancelLifecycle("deletion_pending", future)).toBe(true);
		expect(canCancelLifecycle("deletion_pending", past)).toBe(false);
		expect(canCancelLifecycle("archived", future)).toBe(false);
		expect(getLifecycleMutationBlockReason("Team", "active")).toBeNull();
		expect(getLifecycleMutationBlockReason("Team", "archived")).toContain("archived");
		expect(getLifecycleMutationBlockReason("Team", "deletion_pending")).toContain(
			"deletion-pending"
		);
	});

	test("sets a 30 day recovery window for destructive lifecycle requests", async () => {
		process.env.DATABASE_URL ??= "postgres://localhost/scrimflow_test";
		const { getLifecycleRecoveryUntil } = await import("./lifecycle");
		const now = new Date("2026-05-22T10:00:00.000Z");
		expect(getLifecycleRecoveryUntil(now).toISOString()).toBe("2026-06-21T10:00:00.000Z");
	});

	test("blocks active workflow mutations for archived and irreversible targets", async () => {
		process.env.DATABASE_URL ??= "postgres://localhost/scrimflow_test";
		const { canRunActiveLifecycleMutation, getLifecycleMutationBlockReason } = await import(
			"./lifecycle"
		);

		expect(canRunActiveLifecycleMutation("active")).toBe(true);
		expect(canRunActiveLifecycleMutation("archived")).toBe(false);
		expect(canRunActiveLifecycleMutation("deletion_pending")).toBe(false);
		expect(canRunActiveLifecycleMutation("irreversible")).toBe(false);
		expect(getLifecycleMutationBlockReason("Organization", "irreversible")).toContain(
			"irreversible"
		);
	});
});
