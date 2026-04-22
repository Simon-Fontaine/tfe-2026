import { OrgSettingsPanel } from "@/components/orgs/org-settings-panel";
import {
	OrgWorkspaceMissingState,
	OrgWorkspaceNoAccessState,
} from "@/components/orgs/org-workspace-state";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";

export default async function AppOrgSettingsPage({
	params,
}: {
	params: Promise<{ orgId: string }>;
}) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId } = await params;
	const org = await getOrgWithTeams(orgId, user.id);
	if (!org) return <OrgWorkspaceMissingState />;

	if (!org.currentUser.canManage && !org.currentUser.canLeave && !org.currentUser.canDelete) {
		return (
			<OrgWorkspaceNoAccessState
				title="Settings"
				description="You don't have permission to manage this organisation's settings."
			/>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				title="Settings"
				description={`Ownership, membership, and danger-zone actions for ${org.name}.`}
			/>
			<OrgSettingsPanel org={org} includeProfile={false} />
		</PageContainer>
	);
}
