import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

function findRepoRoot(): string {
  let dir = process.cwd();
  while (true) {
    const turboConfig = join(dir, "turbo.json");
    const gitDir = join(dir, ".git");
    if (existsSync(turboConfig) || existsSync(gitDir)) return dir;

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const thisDir = dirname(fileURLToPath(import.meta.url));
  return join(thisDir, "../..", "..");
}

function loadEnvFiles(root: string) {
  const base = join(root, ".env");
  const local = join(root, ".env.local");

  if (existsSync(base)) {
    loadEnv({ path: base, override: false });
  }

  if (existsSync(local)) {
    loadEnv({ path: local, override: true });
  }
}

const repoRoot = findRepoRoot();
loadEnvFiles(repoRoot);

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .url(
      "DATABASE_URL must be a valid URL (e.g. postgresql://user:password@host:port/db)",
    )
    .min(1, "DATABASE_URL is required"),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
});

if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "?"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment variables: ${message}`);
}

export const env = parsed.data;
export type Env = typeof env;
