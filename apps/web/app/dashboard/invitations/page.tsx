import { Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PendingInviteCard } from "@/components/invites/pending-invite-card";
import { SettingsHeaderBar } from "@/components/settings/settings-header-bar";
import { getCurrentSession } from "@/lib/auth/session";
import { getPendingOrgInvitesForUser } from "@/lib/data/organization";
import { getPendingTeamInvitesForUser } from "@/lib/data/team";

export default async function InvitesPage() {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const [teamInvites, orgInvites] = await Promise.all([
		getPendingTeamInvitesForUser(user.id),
		getPendingOrgInvitesForUser(user.id),
	]);

	const total = teamInvites.length + orgInvites.length;

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			<SettingsHeaderBar
				backHref="/dashboard"
				icon={Mail01Icon}
				title="Invites"
				subtitle="Pending invitations to teams and organisations"
			/>

			{total === 0 ? (
				<div className="flex flex-col items-center justify-center border border-dashed px-6 py-16 text-center">
					<HugeiconsIcon
						icon={Mail01Icon}
						strokeWidth={1.5}
						className="mb-4 size-10 text-muted-foreground/40"
					/>
					<p className="text-sm font-medium">No pending invites</p>
					<p className="mt-1 text-xs text-muted-foreground">
						When someone invites you to a team or organisation, it will appear here.
					</p>
				</div>
			) : (
				<div className="space-y-6">
					{teamInvites.length > 0 && (
						<section className="space-y-3">
							<p className="text-sm font-medium">Team invites</p>
							{teamInvites.map((invite) => (
								<PendingInviteCard key={invite.id} invite={invite} type="team" />
							))}
						</section>
					)}

					{orgInvites.length > 0 && (
						<section className="space-y-3">
							<p className="text-sm font-medium">Organisation invites</p>
							{orgInvites.map((invite) => (
								<PendingInviteCard key={invite.id} invite={invite} type="org" />
							))}
						</section>
					)}
				</div>
			)}
		</div>
	);
}
