import { AlertCircleIcon, LockIcon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { PageContainer } from "@/components/workspace/page-container";
import { appRoutes } from "@/lib/routes";

export function OrgWorkspaceMissingState() {
	return (
		<PageContainer>
			<PageHeader title="Organization" meta="We couldn't open this workspace." />
			<EmptyStateBlock
				icon={AlertCircleIcon}
				title="Organization unavailable"
				description="This organization no longer exists for your account, or you no longer have access. Return to Organizations and open another workspace."
				actionHref={appRoutes.orgs.root}
				actionLabel="Back to organizations"
				variant="page"
			/>
		</PageContainer>
	);
}

export function OrgWorkspaceNoAccessState({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<PageContainer>
			<PageHeader title={title} />
			<EmptyStateBlock icon={LockIcon} title="No access" description={description} variant="card" />
		</PageContainer>
	);
}

export function OrgWorkspaceInvitesEmptyState() {
	return (
		<EmptyStateBlock
			icon={UserGroupIcon}
			title="No pending invites"
			description="Invite a player, coach, or staff member to start tracking outstanding outreach here."
			variant="card"
		/>
	);
}
