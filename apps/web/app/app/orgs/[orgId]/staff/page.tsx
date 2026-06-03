import { UserAdd01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { appRoutes, publicRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { InviteMemberDialog } from "@/components/orgs/invite-member-dialog";
import { MemberActionsDropdown } from "@/components/orgs/member-actions-dropdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { getOrgWithTeamsRouteState, type OrgMemberSummary } from "@/lib/data/orgs";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

const ROLE_LABELS: Record<string, string> = {
	owner: "Owner",
	admin: "Admin",
	member: "Member",
};

function formatDate(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Unknown";
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(date);
}

function formatMemberType(member: OrgMemberSummary) {
	if (member.memberType === "staff") return member.staffRole ?? "Staff";
	return member.gameRole ?? "Player";
}

function MemberTable({
	title,
	members,
	emptyTitle,
	canManage,
	orgId,
	viewerRole,
	userId,
}: {
	title: string;
	members: OrgMemberSummary[];
	emptyTitle: string;
	canManage: boolean;
	orgId: string;
	viewerRole: OrgMemberSummary["role"];
	userId: string;
}) {
	return (
		<section className="flex flex-col gap-4">
			<h2 className="mb-4 border-b pb-2 text-lg font-semibold">{title}</h2>
			{members.length === 0 ? (
				<EmptyState icon={UserGroupIcon} title={emptyTitle} />
			) : (
				<div className="overflow-hidden border">
					<div className="grid grid-cols-[minmax(13rem,1.5fr)_repeat(4,minmax(6rem,1fr))_3rem] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
						<span>Member</span>
						<span>Permission</span>
						<span>Type</span>
						<span>Teams</span>
						<span>Joined</span>
						<span className="text-right">Actions</span>
					</div>
					<div className="divide-y">
						{members.map((member) => (
							<div
								key={member.id}
								className="grid grid-cols-[minmax(13rem,1.5fr)_repeat(4,minmax(6rem,1fr))_3rem] gap-3 px-4 py-3 text-sm"
							>
								<div className="flex min-w-0 items-center gap-3">
									<Avatar className="size-8 shrink-0 overflow-hidden rounded-none after:rounded-none">
										<AvatarImage src={member.avatarUrl ?? undefined} className="rounded-none" />
										<AvatarFallback className="rounded-none text-[10px] font-bold">
											{member.displayName.slice(0, 2).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0">
										<Link
											href={publicRoutes.players.byUsername(member.username)}
											className="block truncate font-medium hover:underline"
										>
											{member.displayName}
										</Link>
										<p className="truncate text-xs text-muted-foreground">@{member.username}</p>
									</div>
								</div>
								<span>
									<Badge variant="outline">{ROLE_LABELS[member.role] ?? member.role}</Badge>
								</span>
								<span className="capitalize">{formatMemberType(member)}</span>
								<span>
									{member.activeTeamCount} active team
									{member.activeTeamCount === 1 ? "" : "s"}
								</span>
								<span>{formatDate(member.joinedAt)}</span>
								<div className="flex justify-end">
									{canManage && member.userId !== userId ? (
										<MemberActionsDropdown orgId={orgId} member={member} viewerRole={viewerRole} />
									) : null}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</section>
	);
}

export default async function AppOrgStaffPage({ params }: { params: Promise<{ orgId: string }> }) {
	const { user } = await requireWorkspaceSession();

	const { orgId } = await params;
	const org = await getOrgWithTeamsRouteState(orgId, user.id);
	if (org.kind === "missing") notFound();
	if (org.kind !== "success") {
		return (
			<AccessGate
				title="Staff"
				resourceType="organization"
				reason={org.kind === "no-access" ? org.reason : undefined}
			/>
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
				breadcrumbs={
					<>
						<Link href={appRoutes.orgs.root} className="hover:underline">
							Orgs
						</Link>
						{" / "}
						<Link href={appRoutes.orgs.byId(orgDetail.id)} className="hover:underline">
							{orgDetail.name}
						</Link>
						{" / Staff"}
					</>
				}
				meta={`/${orgDetail.slug} - ${leadershipAndStaff.length} staff - ${rosterPlayers.length} roster-linked players - ${orgDetail.pendingInvites.length} pending invites`}
				action={
					canManage ? (
						<InviteMemberDialog orgId={orgDetail.id}>
							<Button size="sm">
								<HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} data-icon="inline-start" />
								Invite member
							</Button>
						</InviteMemberDialog>
					) : undefined
				}
			/>

			{canManage ? (
				<section className="flex flex-col gap-4">
					<h2 className="mb-4 border-b pb-2 text-lg font-semibold">Invites</h2>
					<div className="border-b py-3 text-sm">
						<Link
							href={appRoutes.orgs.invites(orgDetail.id)}
							className="font-medium hover:underline"
						>
							{orgDetail.pendingInvites.length} pending invite
							{orgDetail.pendingInvites.length === 1 ? "" : "s"}
						</Link>
					</div>
				</section>
			) : null}

			<MemberTable
				title="Leadership & staff"
				members={leadershipAndStaff}
				emptyTitle="No org staff yet"
				canManage={canManage}
				orgId={orgDetail.id}
				viewerRole={orgDetail.currentUser.role ?? "member"}
				userId={user.id}
			/>

			<MemberTable
				title="Roster-linked players"
				members={rosterPlayers}
				emptyTitle="No roster-linked players"
				canManage={canManage}
				orgId={orgDetail.id}
				viewerRole={orgDetail.currentUser.role ?? "member"}
				userId={user.id}
			/>
		</PageContainer>
	);
}
