import { UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { InviteMemberDialog } from "@/components/orgs/invite-member-dialog";
import { OrgPendingInvitesSection } from "@/components/orgs/org-pending-invites-section";
import { Button } from "@/components/ui/button";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { getOrgWithTeamsRouteState } from "@/lib/data/orgs";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppOrgInvitesPage({
	params,
}: {
	params: Promise<{ orgId: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { orgId } = await params;
	const org = await getOrgWithTeamsRouteState(orgId, user.id);
	if (org.kind === "missing") notFound();
	if (org.kind === "no-access") {
		return <AccessGate title="Invites" resourceType="organization" reason={org.reason} />;
	}
	if (org.kind !== "success" || !org.data.currentUser.canManage) {
		return (
			<AccessGate
				title="Invites"
				resourceType="organization"
				reason={org.kind === "success" ? "role" : undefined}
			/>
		);
	}
	const orgDetail = org.data;

	return (
		<PageContainer>
			<PageHeader
				title="Invites"
				breadcrumbs={
					<>
						<Link href={appRoutes.orgs.root} className="hover:underline">
							Orgs
						</Link>
						{" / "}
						<Link href={appRoutes.orgs.byId(orgDetail.id)} className="hover:underline">
							{orgDetail.name}
						</Link>
						{" / Invites"}
					</>
				}
				meta={`/${orgDetail.slug} - ${orgDetail.pendingInvites.length} pending invites - ${orgDetail.members.length} members`}
				action={
					<InviteMemberDialog orgId={orgDetail.id}>
						<Button size="sm">
							<HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} data-icon="inline-start" />
							Invite member
						</Button>
					</InviteMemberDialog>
				}
			/>

			<section className="flex flex-col gap-4">
				<h2 className="mb-4 border-b pb-2 text-lg font-semibold">Pending invites</h2>
				<OrgPendingInvitesSection orgId={orgDetail.id} invites={orgDetail.pendingInvites} />
			</section>
		</PageContainer>
	);
}
