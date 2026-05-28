import { notFound } from "next/navigation";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { OrgUpdatesPageClient } from "@/components/updates/org-updates-page-client";
import { AccessGate } from "@/components/workspace/access-gate";
import { LoadMoreButton } from "@/components/workspace/load-more-button";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getOrgWithTeamsRouteState } from "@/lib/data/orgs";
import { getOrgUpdatesRouteState } from "@/lib/data/updates";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function OrgUpdatesPage({
	params,
	searchParams,
}: {
	params: Promise<{ orgId: string }>;
	searchParams: Promise<{ cursor?: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { orgId } = await params;
	const { cursor } = await searchParams;

	const org = await getOrgWithTeamsRouteState(orgId, user.id);
	if (org.kind === "missing") notFound();
	if (org.kind !== "success" || !org.data.currentUser.role) {
		return <AccessGate title="Updates" resourceType="organization" />;
	}

	const updates = await getOrgUpdatesRouteState(orgId, cursor);
	if (updates.kind === "no-access") {
		return <AccessGate title="Updates" resourceType="organization" />;
	}
	if (updates.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader
					title="Updates"
					detail={`/${org.data.slug}`}
					description="Announcements posted by organization managers."
				/>
				<EmptyStateBlock
					title="Updates unavailable"
					description="This organization's update feed could not be loaded."
					variant="card"
				/>
			</PageContainer>
		);
	}

	const { posts, nextCursor } = updates.data;

	return (
		<PageContainer>
			<PageHeader
				title="Updates"
				detail={`/${org.data.slug}`}
				description="Announcements posted by organization managers."
			/>
			<OrgUpdatesPageClient
				organizationId={orgId}
				canManage={org.data.currentUser.canManage}
				initialUpdates={posts}
			/>
			{nextCursor && <LoadMoreButton nextCursor={nextCursor} />}
		</PageContainer>
	);
}
