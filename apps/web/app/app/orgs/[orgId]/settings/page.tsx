import { LockIcon } from "@hugeicons/core-free-icons";
import { notFound } from "next/navigation";
import { OrgSettingsPanel } from "@/components/orgs/org-settings-panel";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
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
	if (!org) notFound();

	if (!org.currentUser.canManage && !org.currentUser.canLeave && !org.currentUser.canDelete) {
		return (
			<PageContainer>
				<PageHeader title="Settings" />
				<EmptyStateBlock
					icon={LockIcon}
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
				description={`Ownership, membership, and danger-zone actions for ${org.name}.`}
			/>
			<OrgSettingsPanel org={org} includeProfile={false} />
		</PageContainer>
	);
}
