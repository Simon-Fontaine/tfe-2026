import { Add01Icon, ArrowLeft01Icon, UserAdd01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteOrgDialog } from "@/components/orgs/delete-org-dialog";
import { InviteMemberDialog } from "@/components/orgs/invite-member-dialog";
import { MemberActionsDropdown } from "@/components/orgs/member-actions-dropdown";
import { OrgPendingInvitesSection } from "@/components/orgs/org-pending-invites-section";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { TeamCard } from "@/components/teams/team-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgPendingInvites, getOrgWithTeams } from "@/lib/data/organization";

const ROLE_LABELS: Record<string, string> = {
	owner: "Owner",
	manager: "Manager",
	coach: "Coach",
	analyst: "Analyst",
	player: "Player",
};

export default async function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId } = await params;
	const org = await getOrgWithTeams(orgId, user.id);
	if (!org) notFound();

	const myRole = org.members.find((m) => m.userId === user.id)?.role;
	const canManage = myRole === "owner" || myRole === "manager";
	const isOwner = myRole === "owner";

	const pendingInvites = canManage ? await getOrgPendingInvites(org.id, user.id) : [];

	return (
		<div className="space-y-6">
			{/* Org header */}
			<div className="flex items-start gap-4">
				<Button asChild variant="ghost" size="sm" className="-ml-2 mt-0.5 shrink-0">
					<Link href="/dashboard/workspace/orgs">
						<HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="mr-1 size-4" />
						Workspace
					</Link>
				</Button>
			</div>

			<div className="flex items-center gap-4">
				<Avatar className="size-12 overflow-hidden rounded-none after:rounded-none">
					<AvatarImage src={org.avatarUrl ?? undefined} className="rounded-none" />
					<AvatarFallback className="rounded-none text-sm font-bold">
						{org.name.substring(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<h2 className="text-base font-bold">{org.name}</h2>
					<p className="text-xs text-muted-foreground">/{org.slug}</p>
					{org.description && (
						<p className="mt-1 text-xs text-muted-foreground">{org.description}</p>
					)}
				</div>
				{isOwner && (
					<DeleteOrgDialog orgId={org.id} orgName={org.name}>
						<Button size="sm" variant="destructive">
							Delete workspace org
						</Button>
					</DeleteOrgDialog>
				)}
			</div>

			<Separator />

			{/* Teams */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<p className="text-sm font-medium">
						Teams{" "}
						<span className="ml-1 font-normal text-xs text-muted-foreground">
							{org.teams.length}
						</span>
					</p>
					{canManage && (
						<CreateTeamDialog orgId={org.id}>
							<Button size="sm" variant="outline">
								<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
								New team
							</Button>
						</CreateTeamDialog>
					)}
				</div>

				{org.teams.length === 0 ? (
					<div className="flex flex-col items-center justify-center border border-dashed px-6 py-10 text-center">
						<p className="text-sm font-medium">No teams yet</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Create a team to start adding players and scheduling scrims.
						</p>
						{canManage && (
							<CreateTeamDialog orgId={org.id}>
								<Button size="sm" className="mt-4">
									Create team
								</Button>
							</CreateTeamDialog>
						)}
					</div>
				) : (
					<div className="grid gap-3 sm:grid-cols-2">
						{org.teams.map((team) => (
							<TeamCard key={team.id} team={team} orgId={org.id} />
						))}
					</div>
				)}
			</div>

			<Separator />

			{/* Members */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-3">
					<CardTitle className="text-sm">Members</CardTitle>
					{canManage && (
						<InviteMemberDialog orgId={org.id}>
							<Button size="sm" variant="outline">
								<HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} className="mr-1.5 size-4" />
								Invite member
							</Button>
						</InviteMemberDialog>
					)}
				</CardHeader>
				<CardContent className="space-y-2">
					{org.members.map((member) => (
						<div key={member.id} className="flex items-center gap-3">
							<Avatar className="size-7 overflow-hidden rounded-none after:rounded-none">
								<AvatarImage src={member.avatarUrl ?? undefined} className="rounded-none" />
								<AvatarFallback className="rounded-none text-[10px]">
									<HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-3" />
								</AvatarFallback>
							</Avatar>
							<span className="flex-1 text-xs font-medium">{member.displayName}</span>
							<Badge variant="secondary" className="text-[10px]">
								{ROLE_LABELS[member.role] ?? member.role}
							</Badge>
							{canManage && member.userId !== user.id && (
								<MemberActionsDropdown orgId={org.id} member={member} />
							)}
						</div>
					))}
				</CardContent>
			</Card>

			{canManage && (
				<>
					<Separator />

					<div className="space-y-3">
						<p className="text-sm font-medium">
							Pending invites{" "}
							<span className="ml-1 font-normal text-xs text-muted-foreground">
								{pendingInvites.length}
							</span>
						</p>
						<OrgPendingInvitesSection orgId={org.id} invites={pendingInvites} />
					</div>
				</>
			)}
		</div>
	);
}
