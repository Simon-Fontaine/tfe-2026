"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sensitiveActionVerificationTable } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth/session";

export interface PendingVerifications {
	/** Non-null when an email_change verification is pending; contains the target email. */
	emailChange: { pendingEmail: string } | null;
	/** True when a password_change verification is pending. */
	passwordChange: boolean;
	/** True when a two_factor_disable verification is pending. */
	twoFactorDisable: boolean;
	/** Non-null when a passkey_disable verification is pending; contains the credential info. */
	passkeyDisable: { credentialId: string; credentialName: string } | null;
	/** Non-null when a security_key_disable verification is pending; contains the credential info. */
	securityKeyDisable: { credentialId: string; credentialName: string } | null;
}

/**
 * Returns pending (non-expired, non-consumed) sensitive action verifications
 * for the current user, so that UI components can restore their step state
 * on page load instead of always starting at "idle".
 */
export async function getPendingVerificationsAction(): Promise<PendingVerifications> {
	const { session } = await getCurrentSession();
	if (!session) {
		return {
			emailChange: null,
			passwordChange: false,
			twoFactorDisable: false,
			passkeyDisable: null,
			securityKeyDisable: null,
		};
	}

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

	return {
		emailChange: emailRow
			? {
					pendingEmail: (emailRow.metadata as { newEmail?: string } | null)?.newEmail ?? "",
				}
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
	};
}
