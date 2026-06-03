import { LockIcon } from "@hugeicons/core-free-icons";
import { appRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrgProfilePanel } from "@/components/orgs/org-profile-panel";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
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

	const breadcrumbs = (
		<>
			<Link href={appRoutes.orgs.root} className="hover:underline">
				Orgs
			</Link>
			{" / "}
			<Link href={appRoutes.orgs.byId(org.data.id)} className="hover:underline">
				{org.data.name}
			</Link>
			{" / Brand"}
		</>
	);

	if (!org.data.currentUser.canManageBrand) {
		return (
			<PageContainer>
				<PageHeader title="Brand" breadcrumbs={breadcrumbs} meta={`/${org.data.slug}`} />
				<EmptyState icon={LockIcon} title="No access" />
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageHeader title="Brand" breadcrumbs={breadcrumbs} meta={`/${org.data.slug}`} />
			<OrgProfilePanel org={org.data} />
		</PageContainer>
	);
}
