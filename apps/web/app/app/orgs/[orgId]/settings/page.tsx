import { appRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrgSettingsPanel } from "@/components/orgs/org-settings-panel";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
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
				breadcrumbs={
					<>
						<Link href={appRoutes.orgs.root} className="hover:underline">
							Orgs
						</Link>
						{" / "}
						<Link href={appRoutes.orgs.byId(org.data.id)} className="hover:underline">
							{org.data.name}
						</Link>
						{" / Settings"}
					</>
				}
				meta={`/${org.data.slug} - ${org.data.currentUser.role ?? "member"} - ${org.data.lifecycleStatus}`}
			/>
			<OrgSettingsPanel org={org.data} currentUserId={user.id} includeProfile={false} />
		</PageContainer>
	);
}
