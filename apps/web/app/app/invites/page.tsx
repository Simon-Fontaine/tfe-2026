import { Mail01Icon } from "@hugeicons/core-free-icons";
import { PendingInviteCard } from "@/components/invites/pending-invite-card";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/workspace/page-container";
import { PageSection } from "@/components/workspace/page-section";
import { getPendingOrgInvitesForUser } from "@/lib/data/organization";
import { getPendingTeamInvitesForUser } from "@/lib/data/team";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function InvitesPage() {
	const { user } = await requireWorkspaceSession();

	const [teamInvites, orgInvites] = await Promise.all([
		getPendingTeamInvitesForUser(user.id).catch(() => []),
		getPendingOrgInvitesForUser(user.id).catch(() => []),
	]);

	const pendingTeamInvites = teamInvites.filter(
		(i) => i.status === "pending" && new Date(i.expiresAt) > new Date()
	);
	const pendingOrgInvites = orgInvites.filter(
		(i) => i.status === "pending" && new Date(i.expiresAt) > new Date()
	);

	const hasAny = pendingTeamInvites.length > 0 || pendingOrgInvites.length > 0;

	return (
		<PageContainer>
			<PageHeader title="Invites" />

			{!hasAny && <EmptyState icon={Mail01Icon} title="No pending invites" />}

			{pendingTeamInvites.length > 0 && (
				<PageSection title="Team invites">
					<div className="space-y-2">
						{pendingTeamInvites.map((invite) => (
							<PendingInviteCard key={invite.id} type="team" invite={invite} />
						))}
					</div>
				</PageSection>
			)}

			{pendingOrgInvites.length > 0 && (
				<PageSection title="Organization invites">
					<div className="space-y-2">
						{pendingOrgInvites.map((invite) => (
							<PendingInviteCard key={invite.id} type="org" invite={invite} />
						))}
					</div>
				</PageSection>
			)}
		</PageContainer>
	);
}
