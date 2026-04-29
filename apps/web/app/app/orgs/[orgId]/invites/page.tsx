import { notFound } from "next/navigation";
import { InviteMemberDialog } from "@/components/orgs/invite-member-dialog";
import { OrgPendingInvitesSection } from "@/components/orgs/org-pending-invites-section";
import { OrgWorkspaceInvitesEmptyState } from "@/components/orgs/org-workspace-state";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { getOrgWithTeamsRouteState } from "@/lib/data/orgs";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppOrgInvitesPage({
	params,
}: {
	params: Promise<{ orgId: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { orgId } = await params;
	const org = await getOrgWithTeamsRouteState(orgId, user.id);
	if (org.kind === "missing") notFound();
	if (org.kind !== "success" || !org.data.currentUser.canManage) {
		return (
			<PageContainer>
				<PageHeader title="Invites" detail={`Organization ${orgId}`} />
				<EmptyStateBlock
					title="No access"
					description="You don't have permission to manage this organisation's invites."
					variant="card"
				/>
			</PageContainer>
		);
	}
	const orgDetail = org.data;

	return (
		<PageContainer>
			<PageHeader
				title="Invites"
				detail={`/${orgDetail.slug}`}
				description={`Outstanding organisation invites for ${orgDetail.name}.`}
				actions={
					<InviteMemberDialog orgId={orgDetail.id}>
						<Button size="sm">Invite member</Button>
					</InviteMemberDialog>
				}
			/>

			<PageSection
				title="Pending invites"
				description="Track invite status, resend outreach, and cancel stale invitations."
			>
				{orgDetail.pendingInvites.length === 0 ? (
					<OrgWorkspaceInvitesEmptyState />
				) : (
					<OrgPendingInvitesSection orgId={orgDetail.id} invites={orgDetail.pendingInvites} />
				)}
			</PageSection>
		</PageContainer>
	);
}
