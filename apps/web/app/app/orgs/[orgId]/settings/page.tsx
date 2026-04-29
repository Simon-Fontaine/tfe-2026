import { notFound } from "next/navigation";
import { OrgSettingsPanel } from "@/components/orgs/org-settings-panel";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getOrgWithTeamsRouteState } from "@/lib/data/orgs";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppOrgSettingsPage({
	params,
}: {
	params: Promise<{ orgId: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { orgId } = await params;
	const org = await getOrgWithTeamsRouteState(orgId, user.id);
	if (org.kind === "missing") notFound();
	if (org.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader title="Settings" detail={`Organization ${orgId}`} />
				<EmptyStateBlock
					title="No access"
					description="You do not have permission to open this organisation settings workspace."
					variant="card"
				/>
			</PageContainer>
		);
	}

	if (
		!org.data.currentUser.canManage &&
		!org.data.currentUser.canLeave &&
		!org.data.currentUser.canDelete
	) {
		return (
			<PageContainer>
				<PageHeader title="Settings" detail={`/${org.data.slug}`} />
				<EmptyStateBlock
					title="No access"
					description="You don't have permission to manage this organisation's settings."
					variant="card"
				/>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				title="Settings"
				detail={`/${org.data.slug}`}
				description={`Ownership, membership, and danger-zone actions for ${org.data.name}.`}
			/>
			<OrgSettingsPanel org={org.data} includeProfile={false} />
		</PageContainer>
	);
}
