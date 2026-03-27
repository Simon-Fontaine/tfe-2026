import { LockIcon } from "@hugeicons/core-free-icons";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { OrgSettingsPanel } from "@/components/orgs/org-settings-panel";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";

export default async function OrgSettingsPage({ params }: { params: Promise<{ orgId: string }> }) {
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
				description="Manage organisation profile, ownership, and danger zone actions."
			/>
			<OrgSettingsPanel org={org} />
		</PageContainer>
	);
}
