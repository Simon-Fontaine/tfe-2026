import { getAccountDeletionStatusAction } from "@/app/actions/settings/account-deletion";
import { getPendingVerificationsAction } from "@/app/actions/settings/pending-verifications";
import { PageHeader } from "@/components/layout/PageHeader";
import { ChangeEmailSection } from "@/components/settings/change-email-section";
import { ChangeUsernameSection } from "@/components/settings/change-username-section";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { Separator } from "@/components/ui/separator";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppAccountSettingsPage() {
	const { user } = await requireWorkspaceSession();

	const [pending, deletionStatus] = await Promise.all([
		getPendingVerificationsAction(),
		getAccountDeletionStatusAction(),
	]);

	return (
		<>
			<PageHeader breadcrumbs="Settings / Account" title="Account" />
			<div className="space-y-6">
				<section>
					<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Username
					</p>
					<ChangeUsernameSection currentUsername={user.username} />
				</section>
				<Separator />
				<section>
					<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Email Address
					</p>
					<ChangeEmailSection
						initialStep={pending.emailChange ? "code-sent" : "idle"}
						initialPendingEmail={pending.emailChange?.pendingEmail}
					/>
				</section>
				<Separator />
				<section>
					<p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Danger Zone
					</p>
					<DeleteAccountSection initialStatus={deletionStatus} />
				</section>
			</div>
		</>
	);
}
