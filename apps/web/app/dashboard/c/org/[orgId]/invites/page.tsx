import { LockIcon } from "@hugeicons/core-free-icons";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSection } from "@/components/dashboard/page-section";
import { OrgPendingInvitesSection } from "@/components/orgs/org-pending-invites-section";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";

export default async function OrgInvitesPage({ params }: { params: Promise<{ orgId: string }> }) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId } = await params;
	const org = await getOrgWithTeams(orgId, user.id);
	if (!org) notFound();

	return (
		<PageContainer>
			<PageHeader title="Invites" description={`Pending organisation invites for ${org.name}.`} />

			{!org.currentUser.canManageInvites ? (
				<EmptyStateBlock
					icon={LockIcon}
					title="No access"
					description="You do not have permission to manage organisation invites."
					variant="card"
				/>
			) : (
				<PageSection title="Pending invites">
					<OrgPendingInvitesSection orgId={org.id} invites={org.pendingInvites} />
				</PageSection>
			)}
		</PageContainer>
	);
}
