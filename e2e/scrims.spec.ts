import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

let homeTeamId: string;

test.beforeAll(() => {
	const fixtures = JSON.parse(
		readFileSync(join(process.cwd(), ".playwright/fixtures.json"), "utf-8")
	);
	homeTeamId = fixtures.homeTeamId;
});

test("scrim creation smoke test", async ({ page }) => {
	await page.goto(`/app/teams/${homeTeamId}/scrims`);

	// The "Schedule Scrim" button is only visible to team admins with canManage
	await expect(page.getByRole("button", { name: /Schedule Scrim/i }).first()).toBeVisible({
		timeout: 10_000,
	});
	await page
		.getByRole("button", { name: /Schedule Scrim/i })
		.first()
		.click();

	// Wait for dialog to open
	await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

	// Set scheduledAt to 7 days in the future
	const scheduledAt = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 16);
	await page.locator('input[type="datetime-local"]').fill(scheduledAt);

	// Submit — button text is "Create request"
	await page.getByRole("button", { name: /Create request/i }).click();

	// After submission the dialog navigates to the new scrim detail page
	await page.waitForURL(/\/scrims\//, { timeout: 15_000 });
	await expect(page).toHaveURL(/\/scrims\//);
});
