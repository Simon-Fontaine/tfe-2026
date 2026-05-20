import { getAccountDeletionStatusAction } from "@/app/actions/settings/account-deletion";
import { getPendingVerificationsAction } from "@/app/actions/settings/pending-verifications";
import { ChangeEmailSection } from "@/components/settings/change-email-section";
import { ChangeUsernameSection } from "@/components/settings/change-username-section";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { SecuritySettingsPageShell } from "@/components/settings/security-settings-page-shell";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppAccountSettingsPage() {
	const { user } = await requireWorkspaceSession();

	const [pending, deletionStatus] = await Promise.all([
		getPendingVerificationsAction(),
		getAccountDeletionStatusAction(),
	]);

	return (
		<SecuritySettingsPageShell>
			<ChangeUsernameSection currentUsername={user.username} />

			<ChangeEmailSection
				currentEmail={user.email}
				initialStep={pending.emailChange ? "code-sent" : "idle"}
				initialPendingEmail={pending.emailChange?.pendingEmail}
			/>

			<DeleteAccountSection initialStatus={deletionStatus} />
		</SecuritySettingsPageShell>
	);
}
