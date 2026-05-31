import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

let targetListingId: string;

test.beforeAll(() => {
	const fixtures = JSON.parse(
		readFileSync(join(process.cwd(), ".playwright/fixtures.json"), "utf-8")
	);
	targetListingId = fixtures.targetListingId;
});

test("recruiting application smoke test", async ({ page }) => {
	await page.goto(`/app/recruiting/${targetListingId}`);

	// The Apply button is visible when canApply is true
	await expect(page.getByRole("button", { name: /apply/i })).toBeVisible({ timeout: 10_000 });
	await page.getByRole("button", { name: /apply/i }).click();

	// Wait for dialog to open
	await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

	// Submit without a message — message field is optional
	await page.getByRole("button", { name: /Send application/i }).click();

	// After submission the app navigates to conversations; wait for that redirect
	await page.waitForURL(/recruiting/, { timeout: 15_000 });

	// Navigate to the recruiting index page to verify the sent application appears
	await page.goto("/app/recruiting");

	// The "Sent applications" section should list the target listing
	const sentSection = page.locator("section").filter({ hasText: "Sent applications" });
	await expect(sentSection.getByText("E2E Test Listing").first()).toBeVisible({
		timeout: 10_000,
	});
});
