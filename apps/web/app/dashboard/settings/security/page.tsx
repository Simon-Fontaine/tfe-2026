import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
	listPasskeysAction,
	listSecurityKeysAction,
} from "@/app/(auth)/auth/webauthn-setup-actions";
import { getPendingVerificationsAction } from "@/app/dashboard/settings/actions/pending-verifications";
import { ActiveSessionsSection } from "@/components/settings/active-sessions-section";
import { ChangePasswordSection } from "@/components/settings/change-password-section";
import { PasskeyManagementSection } from "@/components/settings/passkey-management-section";
import { SecurityAccountSummaryCard } from "@/components/settings/security-account-summary-card";
import { SecurityKeyManagementSection } from "@/components/settings/security-key-management-section";
import { SecuritySettingsPageShell } from "@/components/settings/security-settings-page-shell";
import { TotpManagementSection } from "@/components/settings/totp-management-section";
import { TwoFactorMethodsSection } from "@/components/settings/two-factor-methods-section";
import { db } from "@/db";
import { userTable } from "@/db/schema";
import { getCurrentSession } from "@/lib/auth/session";
import { SecurityStatusProvider } from "@/stores/security-status";

export default async function SecuritySettingsPage() {
	const { session, user } = await getCurrentSession();
	if (!session || !user) redirect("/auth");

	const [userRow, passkeys, securityKeys, pending] = await Promise.all([
		db
			.select({ passwordHash: userTable.passwordHash })
			.from(userTable)
			.where(eq(userTable.id, user.id))
			.limit(1)
			.then((rows) => rows[0] ?? null),
		listPasskeysAction(),
		listSecurityKeysAction(),
		getPendingVerificationsAction(),
	]);

	const hasPassword = !!userRow?.passwordHash;

	return (
		<SecurityStatusProvider
			initialHasTOTP={user.registeredTOTP}
			initialPasskeyCount={passkeys.length}
			initialSecurityKeyCount={securityKeys.length}
		>
			<SecuritySettingsPageShell>
				<SecurityAccountSummaryCard email={user.email} hasPassword={hasPassword} />

				<ChangePasswordSection initialStep={pending.passwordChange ? "code-sent" : "idle"} />

				<TwoFactorMethodsSection />

				<TotpManagementSection initialDisableConfirm={pending.twoFactorDisable} />

				<PasskeyManagementSection
					userId={user.id}
					userName={user.username}
					userDisplayName={user.displayName}
					initialDisableConfirm={pending.passkeyDisable}
				/>

				<SecurityKeyManagementSection
					userId={user.id}
					userName={user.username}
					userDisplayName={user.displayName}
					initialDisableConfirm={pending.securityKeyDisable}
				/>

				<ActiveSessionsSection />
			</SecuritySettingsPageShell>
		</SecurityStatusProvider>
	);
}
