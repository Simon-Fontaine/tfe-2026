import { LockIcon } from "@hugeicons/core-free-icons";
import { notFound } from "next/navigation";
import { OrgProfilePanel } from "@/components/orgs/org-profile-panel";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";

export default async function AppOrgBrandPage({ params }: { params: Promise<{ orgId: string }> }) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId } = await params;
	const org = await getOrgWithTeams(orgId, user.id);
	if (!org) notFound();

	if (!org.currentUser.canManage) {
		return (
			<PageContainer>
				<PageHeader title="Brand" />
				<EmptyStateBlock
					icon={LockIcon}
					title="No access"
					description="You don't have permission to manage this organisation's brand profile."
					variant="card"
				/>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				title="Brand"
				description={`Manage ${org.name}'s public identity, media assets, and profile presentation.`}
			/>
			<OrgProfilePanel org={org} />
		</PageContainer>
	);
}
