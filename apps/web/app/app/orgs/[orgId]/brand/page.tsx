import { notFound } from "next/navigation";
import { OrgProfilePanel } from "@/components/orgs/org-profile-panel";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getOrgWithTeamsRouteState } from "@/lib/data/orgs";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppOrgBrandPage({ params }: { params: Promise<{ orgId: string }> }) {
	const { user } = await requireWorkspaceSession();

	const { orgId } = await params;
	const org = await getOrgWithTeamsRouteState(orgId, user.id);
	if (org.kind === "missing") notFound();
	if (org.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader title="Brand" detail="organization workspace" />
				<EmptyStateBlock
					title="No access"
					description="You do not have permission to manage this organization's brand profile."
					variant="card"
				/>
			</PageContainer>
		);
	}

	if (!org.data.currentUser.canManage) {
		return (
			<PageContainer>
				<PageHeader title="Brand" detail={`/${org.data.slug}`} />
				<EmptyStateBlock
					title="No access"
					description="You don't have permission to manage this organization's brand profile."
					variant="card"
				/>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				title="Brand"
				detail={`/${org.data.slug}`}
				description={`Manage ${org.data.name}'s public identity, media assets, and profile presentation.`}
			/>
			<OrgProfilePanel org={org.data} />
		</PageContainer>
	);
}
