import { ArrowLeft01Icon, Mail01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddPlayerDialog } from "@/components/teams/add-player-dialog";
import { EditTeamDialog } from "@/components/teams/edit-team-dialog";
import { InvitePlayerDialog } from "@/components/teams/invite-player-dialog";
import { RecruitingToggle } from "@/components/teams/recruiting-toggle";
import { RosterTable } from "@/components/teams/roster-table";
import { TeamApplicationsSection } from "@/components/teams/team-applications-section";
import { TeamInvitesSection } from "@/components/teams/team-invites-section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getCurrentSession } from "@/lib/auth/session";
import { getLfgPostsForTeam, getTeamApplications } from "@/lib/data/lfg";
import { getUserOrgRole } from "@/lib/data/organization";
import { getTeamPendingInvites, getTeamWithRoster } from "@/lib/data/team";

export default async function TeamDetailPage({
	params,
}: {
	params: Promise<{ orgId: string; teamId: string }>;
}) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId, teamId } = await params;
	const [team, orgRole] = await Promise.all([
		getTeamWithRoster(teamId, user.id),
		getUserOrgRole(orgId, user.id),
	]);
	if (!team) notFound();

	const canManage = orgRole === "owner" || orgRole === "manager";

	const [pendingInvites, applications, lfgPosts] = canManage
		? await Promise.all([
				getTeamPendingInvites(teamId, user.id),
				getTeamApplications(teamId),
				getLfgPostsForTeam(teamId),
			])
		: [[], [], []];

	const openPostCount = lfgPosts.filter((p) => p.status === "open").length;

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			{/* Back */}
			<Button asChild variant="ghost" size="sm" className="-ml-2">
				<Link href={`/dashboard/orgs/${orgId}`}>
					<HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="mr-1 size-4" />
					Back to org
				</Link>
			</Button>

			{/* Team header */}
			<div className="flex items-start gap-4">
				<Avatar className="size-12 overflow-hidden rounded-none after:rounded-none">
					<AvatarImage src={team.avatarUrl ?? undefined} className="rounded-none" />
					<AvatarFallback className="rounded-none text-sm font-bold">{team.tag}</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<div className="flex items-baseline gap-2">
						<h2 className="text-base font-bold">{team.name}</h2>
						<span className="font-mono text-xs text-muted-foreground">[{team.tag}]</span>
					</div>
					<p className="text-xs text-muted-foreground">
						SR {team.teamSr} · {team.matchesPlayed} scrims played
					</p>
					{team.description && (
						<p className="mt-1 text-xs text-muted-foreground">{team.description}</p>
					)}
				</div>
				{canManage && (
					<EditTeamDialog
						orgId={orgId}
						teamId={teamId}
						initialValues={{
							name: team.name,
							tag: team.tag,
							description: team.description,
						}}
					>
						<Button size="sm" variant="outline">
							Edit
						</Button>
					</EditTeamDialog>
				)}
			</div>

			{canManage && (
				<RecruitingToggle orgId={orgId} teamId={teamId} isRecruiting={team.isRecruiting} />
			)}

			<Separator />

			{/* Roster */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<p className="text-sm font-medium">
						Roster{" "}
						<span className="ml-1 font-normal text-xs text-muted-foreground">
							{team.roster.filter((r) => r.status !== "inactive").length} active
						</span>
					</p>
					{canManage && (
						<div className="flex gap-2">
							<InvitePlayerDialog teamId={teamId} orgId={orgId}>
								<Button size="sm" variant="outline">
									<HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="mr-1.5 size-4" />
									Invite
								</Button>
							</InvitePlayerDialog>
							<AddPlayerDialog teamId={teamId} orgId={orgId}>
								<Button size="sm" variant="outline">
									<HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} className="mr-1.5 size-4" />
									Add player
								</Button>
							</AddPlayerDialog>
						</div>
					)}
				</div>

				<RosterTable roster={team.roster} canManage={canManage} orgId={orgId} teamId={teamId} />
			</div>

			{canManage && (
				<>
					<Separator />

					{/* Pending invites */}
					<div className="space-y-3">
						<p className="text-sm font-medium">
							Pending invites{" "}
							<span className="ml-1 font-normal text-xs text-muted-foreground">
								{pendingInvites.length}
							</span>
						</p>
						<TeamInvitesSection invites={pendingInvites} />
					</div>

					<Separator />

					{/* Applications */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<p className="text-sm font-medium">
								Applications{" "}
								<span className="ml-1 font-normal text-xs text-muted-foreground">
									{applications.length}
								</span>
							</p>
							{openPostCount > 0 && (
								<span className="text-xs text-muted-foreground">
									{openPostCount} open LFG post{openPostCount === 1 ? "" : "s"}
								</span>
							)}
						</div>
						<TeamApplicationsSection applications={applications} orgId={orgId} />
					</div>
				</>
			)}
		</div>
	);
}
