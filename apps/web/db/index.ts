import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

if (!url) {
	throw new Error("DATABASE_URL is not defined in the environment variables.");
}

const globalForDb = globalThis as unknown as {
	db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

export const db = globalForDb.db ?? drizzle(url, { schema });

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
