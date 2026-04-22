import { InviteMemberDialog } from "@/components/orgs/invite-member-dialog";
import { OrgPendingInvitesSection } from "@/components/orgs/org-pending-invites-section";
import {
	OrgWorkspaceInvitesEmptyState,
	OrgWorkspaceMissingState,
	OrgWorkspaceNoAccessState,
} from "@/components/orgs/org-workspace-state";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";

export default async function AppOrgInvitesPage({
	params,
}: {
	params: Promise<{ orgId: string }>;
}) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId } = await params;
	const org = await getOrgWithTeams(orgId, user.id);
	if (!org) return <OrgWorkspaceMissingState />;
	if (!org.currentUser.canManage) {
		return (
			<OrgWorkspaceNoAccessState
				title="Invites"
				description="You don't have permission to manage this organisation's invites."
			/>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				title="Invites"
				description={`Outstanding organisation invites for ${org.name}.`}
				actions={
					<InviteMemberDialog orgId={org.id}>
						<Button size="sm">Invite member</Button>
					</InviteMemberDialog>
				}
			/>

			<PageSection
				title="Pending invites"
				description="Track invite status, resend outreach, and cancel stale invitations."
			>
				{org.pendingInvites.length === 0 ? (
					<OrgWorkspaceInvitesEmptyState />
				) : (
					<OrgPendingInvitesSection orgId={org.id} invites={org.pendingInvites} />
				)}
			</PageSection>
		</PageContainer>
	);
}
