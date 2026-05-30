import { notFound } from "next/navigation";
import { OrgSettingsPanel } from "@/components/orgs/org-settings-panel";
import { AccessGate } from "@/components/workspace/access-gate";
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
	if (org.kind === "no-access") {
		return <AccessGate title="Settings" resourceType="organization" reason={org.reason} />;
	}
	if (org.kind !== "success") {
		return <AccessGate title="Settings" resourceType="organization" />;
	}

	if (
		!org.data.currentUser.canManage &&
		!org.data.currentUser.canLeave &&
		!org.data.currentUser.canDelete
	) {
		return <AccessGate title="Settings" resourceType="organization" reason="role" />;
	}

	return (
		<PageContainer>
			<PageHeader
				title="Settings"
				detail={`/${org.data.slug}`}
				description={`Ownership, membership, and danger-zone actions for ${org.data.name}.`}
			/>
			<OrgSettingsPanel org={org.data} currentUserId={user.id} includeProfile={false} />
		</PageContainer>
	);
}
