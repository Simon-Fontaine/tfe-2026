import { redirect } from "next/navigation";
import { getPendingVerificationsAction } from "@/app/dashboard/settings/actions/pending-verifications";
import { ChangeEmailSection } from "@/components/settings/change-email-section";
import { ChangeUsernameSection } from "@/components/settings/change-username-section";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { SecuritySettingsPageShell } from "@/components/settings/security-settings-page-shell";
import { getCurrentSession } from "@/lib/auth/session";

export default async function AccountSettingsPage() {
	const { session, user } = await getCurrentSession();
	if (!session || !user) redirect("/auth");

	const pending = await getPendingVerificationsAction();

	return (
		<SecuritySettingsPageShell>
			<ChangeUsernameSection currentUsername={user.username} />

			<ChangeEmailSection
				currentEmail={user.email}
				initialStep={pending.emailChange ? "code-sent" : "idle"}
				initialPendingEmail={pending.emailChange?.pendingEmail}
			/>

			<DeleteAccountSection />
		</SecuritySettingsPageShell>
	);
}
