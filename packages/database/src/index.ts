import { env } from "@workspaces/shared";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./db/schema";

const db = drizzle(env.DATABASE_URL, { schema });
export default db;
