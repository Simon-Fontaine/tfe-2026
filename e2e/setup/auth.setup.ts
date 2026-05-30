import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../../");

export default async function globalSetup() {
	console.log("Running Playwright auth seed...");
	execSync("pnpm run db:seed:playwright", {
		cwd: REPO_ROOT,
		stdio: "inherit",
		timeout: 30_000,
	});
}
