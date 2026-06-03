import { Alert02Icon } from "@hugeicons/core-free-icons";
import { appRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrgUpdatesPageClient } from "@/components/updates/org-updates-page-client";
import { AccessGate } from "@/components/workspace/access-gate";
import { LoadMoreButton } from "@/components/workspace/load-more-button";
import { PageContainer } from "@/components/workspace/page-container";
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

	const breadcrumbs = (
		<>
			<Link href={appRoutes.orgs.root} className="hover:underline">
				Orgs
			</Link>
			{" / "}
			<Link href={appRoutes.orgs.byId(org.data.id)} className="hover:underline">
				{org.data.name}
			</Link>
			{" / Updates"}
		</>
	);

	if (updates.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader
					title="Updates"
					breadcrumbs={breadcrumbs}
					meta={`/${org.data.slug} - feed unavailable`}
				/>
				<EmptyState icon={Alert02Icon} title="Updates unavailable" />
			</PageContainer>
		);
	}

	const { posts, nextCursor } = updates.data;

	return (
		<PageContainer>
			<OrgUpdatesPageClient
				organizationId={orgId}
				orgName={org.data.name}
				orgSlug={org.data.slug}
				canManage={org.data.currentUser.canManage}
				initialUpdates={posts}
			/>
			{nextCursor && <LoadMoreButton nextCursor={nextCursor} />}
		</PageContainer>
	);
}
