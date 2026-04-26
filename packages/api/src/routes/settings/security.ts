import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { generateRecoveryCode } from "@/auth/2fa";
import { encryptStringToText } from "@/crypto/encryption";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import type { RequestContextEnv } from "@/middleware/request-context";

const securityRoutes = new Hono<RequestContextEnv & AuthEnv>();

// GET /summary — Check if user has a password and recovery code set (for security settings page)
securityRoutes.get("/summary", async (c) => {
	const session = c.get("session");
	const row = await db
		.select({ passwordHash: userTable.passwordHash, recoveryCode: userTable.recoveryCode })
		.from(userTable)
		.where(eq(userTable.id, session.userId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	return c.json({
		data: { hasPassword: !!row?.passwordHash, hasRecoveryCode: !!row?.recoveryCode },
	});
});

// POST /recovery-code/regenerate — Generate a new recovery code, store encrypted, return plaintext once
securityRoutes.post("/recovery-code/regenerate", async (c) => {
	const session = c.get("session");
	const plainCode = generateRecoveryCode();
	const encrypted = encryptStringToText(plainCode);
	await db
		.update(userTable)
		.set({ recoveryCode: encrypted })
		.where(eq(userTable.id, session.userId));
	// Return plaintext ONCE — never log it
	return c.json({ data: { recoveryCode: plainCode } });
});

export { securityRoutes };
