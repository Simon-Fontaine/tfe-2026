import { expect, test } from "@playwright/test";

const MAILPIT_API = "http://localhost:8025/api/v1";

// Override global storageState for this file — start without a session
test.use({ storageState: { cookies: [], origins: [] } });

test("auth happy path", async ({ page }) => {
	// Clear Mailpit before the test so only emails from this run appear
	await fetch(`${MAILPIT_API}/messages`, { method: "DELETE" });

	await page.goto("/auth");

	await page.getByLabel(/email/i).fill("playwright@test.scrimflow.local");
	await page.locator('input[type="password"]').fill("TestPassword123!");
	await page.getByRole("button", { name: "Sign in", exact: true }).click();

	// The app may show a "New device detected" verification step for fresh browsers.
	// waitFor resolves true if the heading appears, or false if it never does within the timeout.
	const isNewDevice = await page
		.getByRole("heading", { name: /new device detected/i })
		.waitFor({ timeout: 8_000, state: "visible" })
		.then(() => true)
		.catch(() => false);

	if (isNewDevice) {
		// Poll Mailpit until the verification email arrives (up to 15 s)
		let code: string | null = null;
		for (let i = 0; i < 15 && !code; i++) {
			if (i > 0) await page.waitForTimeout(1_000);
			const res = await fetch(`${MAILPIT_API}/messages`);
			const data = (await res.json()) as { messages?: Array<{ ID: string }> };
			for (const message of data.messages ?? []) {
				const msgRes = await fetch(`${MAILPIT_API}/message/${message.ID}`);
				const msg = (await msgRes.json()) as { HTML?: string; Text?: string };
				const match = `${msg.Text ?? ""}\n${msg.HTML ?? ""}`.match(/\b(\d{6})\b/);
				if (match) code = match[1];
			}
		}
		if (!code) throw new Error("Verification code not received in Mailpit within 15 s");

		await page.getByPlaceholder("000000").fill(code);
		await page.getByRole("button", { name: /verify device/i }).click();
	}

	await page.waitForURL(/\/app/, { timeout: 15_000 });
	await expect(page).toHaveURL(/\/app/);
});
