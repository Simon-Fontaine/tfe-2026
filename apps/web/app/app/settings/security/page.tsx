import { apiRoutes } from "@scrimflow/shared";
import {
	listPasskeysAction,
	listSecurityKeysAction,
} from "@/app/(auth)/auth/webauthn-setup-actions";
import { getPendingVerificationsAction } from "@/app/actions/settings/pending-verifications";
import { PageHeader } from "@/components/layout/PageHeader";
import { ActiveSessionsSection } from "@/components/settings/active-sessions-section";
import { ChangePasswordSection } from "@/components/settings/change-password-section";
import { PasskeyManagementSection } from "@/components/settings/passkey-management-section";
import { RecoveryCodeManagementSection } from "@/components/settings/recovery-code-management-section";
import { SecurityAccountSummaryCard } from "@/components/settings/security-account-summary-card";
import { SecurityKeyManagementSection } from "@/components/settings/security-key-management-section";
import { TotpManagementSection } from "@/components/settings/totp-management-section";
import { TwoFactorMethodsSection } from "@/components/settings/two-factor-methods-section";
import { Separator } from "@/components/ui/separator";
import { apiGet } from "@/lib/api-client";
import { requireWorkspaceSession } from "@/lib/workspace-shell";
import { SecurityStatusProvider } from "@/stores/security-status";

export default async function AppSecuritySettingsPage() {
	const { user } = await requireWorkspaceSession();

	const [securityRes, passkeys, securityKeys, pending] = await Promise.all([
		apiGet<{ hasPassword: boolean; hasRecoveryCode: boolean }>(apiRoutes.settings.security.summary),
		listPasskeysAction(),
		listSecurityKeysAction(),
		getPendingVerificationsAction(),
	]);

	const hasPassword = "data" in securityRes ? securityRes.data.hasPassword : false;
	const hasRecoveryCode = "data" in securityRes ? securityRes.data.hasRecoveryCode : false;

	return (
		<SecurityStatusProvider
			initialHasTOTP={user.registeredTOTP}
			initialPasskeyCount={passkeys.length}
			initialSecurityKeyCount={securityKeys.length}
		>
			<PageHeader breadcrumbs="Settings / Security" title="Security" />
			<div className="space-y-6">
				<SecurityAccountSummaryCard email={user.email} hasPassword={hasPassword} />
				<Separator />
				<section>
					<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Password
					</p>
					<ChangePasswordSection initialStep={pending.passwordChange ? "code-sent" : "idle"} />
				</section>
				<Separator />
				<section>
					<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Two-Factor Authentication
					</p>
					<TwoFactorMethodsSection />
				</section>
				<Separator />
				<section>
					<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Recovery Codes
					</p>
					<RecoveryCodeManagementSection hasRecoveryCode={hasRecoveryCode} />
				</section>
				<Separator />
				<section id="totp">
					<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Authenticator App (TOTP)
					</p>
					<TotpManagementSection initialDisableConfirm={pending.twoFactorDisable} />
				</section>
				<Separator />
				<section id="passkeys">
					<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Passkeys
					</p>
					<PasskeyManagementSection
						userId={user.id}
						userName={user.username}
						userDisplayName={user.displayName}
						initialPasskeys={passkeys}
						initialDisableConfirm={pending.passkeyDisable}
					/>
				</section>
				<Separator />
				<section id="security-keys">
					<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Security Keys
					</p>
					<SecurityKeyManagementSection
						userId={user.id}
						userName={user.username}
						userDisplayName={user.displayName}
						initialSecurityKeys={securityKeys}
						initialDisableConfirm={pending.securityKeyDisable}
					/>
				</section>
				<Separator />
				<section>
					<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Active Sessions
					</p>
					<ActiveSessionsSection />
				</section>
			</div>
		</SecurityStatusProvider>
	);
}
