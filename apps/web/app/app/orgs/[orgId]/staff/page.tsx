import { UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InviteMemberDialog } from "@/components/orgs/invite-member-dialog";
import { MemberActionsDropdown } from "@/components/orgs/member-actions-dropdown";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { getOrgWithTeamsRouteState, type OrgMemberSummary } from "@/lib/data/orgs";
import { appRoutes, publicRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

const ROLE_LABELS: Record<string, string> = {
	owner: "Owner",
	admin: "Admin",
	member: "Member",
};

function MemberRow({
	member,
	canManage,
	orgId,
	viewerRole,
	userId,
}: {
	member: OrgMemberSummary;
	canManage: boolean;
	orgId: string;
	viewerRole: OrgMemberSummary["role"];
	userId: string;
}) {
	return (
		<div className="flex items-center gap-3 border px-3 py-3">
			<Avatar className="size-8 overflow-hidden rounded-none after:rounded-none">
				<AvatarImage src={member.avatarUrl ?? undefined} className="rounded-none" />
				<AvatarFallback className="rounded-none text-[10px] font-bold">
					{member.displayName.slice(0, 2).toUpperCase()}
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1">
				<Link
					href={publicRoutes.players.byUsername(member.username)}
					className="truncate text-xs font-medium hover:underline"
				>
					{member.displayName}
				</Link>
				<p className="text-[11px] text-muted-foreground">
					{member.memberType === "staff"
						? (member.staffRole ?? "staff")
						: (member.gameRole ?? "player")}
					{" · "}
					{member.activeTeamCount} active team
					{member.activeTeamCount === 1 ? "" : "s"}
				</p>
			</div>
			<Badge variant="secondary" className="text-[10px]">
				{ROLE_LABELS[member.role] ?? member.role}
			</Badge>
			{canManage && member.userId !== userId ? (
				<MemberActionsDropdown orgId={orgId} member={member} viewerRole={viewerRole} />
			) : null}
		</div>
	);
}

export default async function AppOrgStaffPage({ params }: { params: Promise<{ orgId: string }> }) {
	const { user } = await requireWorkspaceSession();

	const { orgId } = await params;
	const org = await getOrgWithTeamsRouteState(orgId, user.id);
	if (org.kind === "missing") notFound();
	if (org.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader
					title="Staff"
					detail={`Organization ${orgId}`}
					description="Org admins, coaches, and operational members for this workspace."
				/>
				<EmptyStateBlock
					title="No access"
					description="You do not have permission to open this organization staff workspace."
					variant="card"
				/>
			</PageContainer>
		);
	}
	const orgDetail = org.data;

	const canManage = orgDetail.currentUser.canManage;
	const leadershipAndStaff = orgDetail.members.filter(
		(member) => member.role !== "member" || member.memberType === "staff"
	);
	const rosterPlayers = orgDetail.members.filter(
		(member) => !leadershipAndStaff.some((staffMember) => staffMember.id === member.id)
	);

	return (
		<PageContainer>
			<PageHeader
				title="Staff"
				detail={`/${orgDetail.slug}`}
				description={`Org admins, coaches, and operational members for ${orgDetail.name}.`}
				actions={
					canManage ? (
						<InviteMemberDialog orgId={orgDetail.id}>
							<Button size="sm">
								<HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} className="mr-1.5 size-4" />
								Invite member
							</Button>
						</InviteMemberDialog>
					) : undefined
				}
			/>

			{canManage && (
				<PageSection
					title="Invites"
					description="Pending invites are managed in a dedicated workspace so active staff and outreach stay separate."
				>
					<EmptyStateBlock
						title={`${orgDetail.pendingInvites.length} pending invite${orgDetail.pendingInvites.length === 1 ? "" : "s"}`}
						description="Review pending invites, resend outreach, or cancel stale requests from the invites workspace."
						actionHref={appRoutes.orgs.invites(orgDetail.id)}
						actionLabel="Open invites"
						variant="card"
					/>
				</PageSection>
			)}

			<PageSection
				title="Leadership & staff"
				description="Owners, admins, and non-player staff with organisation-level responsibilities."
			>
				{leadershipAndStaff.length === 0 ? (
					<EmptyStateBlock
						title="No org staff yet"
						description="Invite managers, coaches, or analysts to start delegating org work."
						variant="card"
					/>
				) : (
					<div className="space-y-2">
						{leadershipAndStaff.map((member) => (
							<MemberRow
								key={member.id}
								member={member}
								canManage={canManage}
								orgId={orgDetail.id}
								viewerRole={orgDetail.currentUser.role ?? "member"}
								userId={user.id}
							/>
						))}
					</div>
				)}
			</PageSection>

			{rosterPlayers.length > 0 && (
				<PageSection
					title="Roster-linked players"
					description="Players currently attached to the organisation through active teams."
				>
					<div className="space-y-2">
						{rosterPlayers.map((member) => (
							<MemberRow
								key={member.id}
								member={member}
								canManage={canManage}
								orgId={orgDetail.id}
								viewerRole={orgDetail.currentUser.role ?? "member"}
								userId={user.id}
							/>
						))}
					</div>
				</PageSection>
			)}
		</PageContainer>
	);
}
