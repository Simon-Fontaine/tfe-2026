import { notFound } from "next/navigation";
import { OrgProfilePanel } from "@/components/orgs/org-profile-panel";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { AccessGate } from "@/components/workspace/access-gate";
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
			<AccessGate
				title="Brand"
				resourceType="organization"
				reason={org.kind === "no-access" ? org.reason : undefined}
			/>
		);
	}

	if (!org.data.currentUser.canManageBrand) {
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
