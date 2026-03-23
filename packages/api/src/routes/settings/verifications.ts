import { and, eq, gt, isNull } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/db";
import { sensitiveActionVerificationTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";

const verificationRoutes = new Hono<AuthEnv>();

// GET /pending — Get pending sensitive action verifications
verificationRoutes.get("/pending", async (c) => {
	const session = c.get("session");

	const rows = await db
		.select()
		.from(sensitiveActionVerificationTable)
		.where(
			and(
				eq(sensitiveActionVerificationTable.userId, session.userId),
				gt(sensitiveActionVerificationTable.expiresAt, new Date()),
				isNull(sensitiveActionVerificationTable.verifiedAt)
			)
		);

	const emailRow = rows.find((r) => r.action === "email_change");
	const passwordRow = rows.find((r) => r.action === "password_change");
	const twoFactorRow = rows.find((r) => r.action === "two_factor_disable");
	const passkeyRow = rows.find((r) => r.action === "passkey_disable");
	const securityKeyRow = rows.find((r) => r.action === "security_key_disable");

	type CredentialMeta = { credentialId?: string; credentialName?: string } | null;

	return c.json({
		emailChange: emailRow
			? { pendingEmail: (emailRow.metadata as { newEmail?: string } | null)?.newEmail ?? "" }
			: null,
		passwordChange: !!passwordRow,
		twoFactorDisable: !!twoFactorRow,
		passkeyDisable: passkeyRow
			? {
					credentialId: (passkeyRow.metadata as CredentialMeta)?.credentialId ?? "",
					credentialName: (passkeyRow.metadata as CredentialMeta)?.credentialName ?? "",
				}
			: null,
		securityKeyDisable: securityKeyRow
			? {
					credentialId: (securityKeyRow.metadata as CredentialMeta)?.credentialId ?? "",
					credentialName: (securityKeyRow.metadata as CredentialMeta)?.credentialName ?? "",
				}
			: null,
	});
});

export { verificationRoutes };
