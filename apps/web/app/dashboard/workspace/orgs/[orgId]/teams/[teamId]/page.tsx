import { ArrowLeft01Icon, Mail01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddPlayerDialog } from "@/components/teams/add-player-dialog";
import { InvitePlayerDialog } from "@/components/teams/invite-player-dialog";
import { RecruitingToggle } from "@/components/teams/recruiting-toggle";
import { RosterTable } from "@/components/teams/roster-table";
import { TeamApplicationsSection } from "@/components/teams/team-applications-section";
import { TeamInvitesSection } from "@/components/teams/team-invites-section";
import { TeamJoinRequestsSection } from "@/components/teams/team-join-requests-section";
import { TeamSettingsPanel } from "@/components/teams/team-settings-panel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentSession } from "@/lib/auth/session";
import { getTeamWithRoster } from "@/lib/data/teams";
import { dashboardRoutes } from "@/lib/routes";

interface TeamDetailPageProps {
	params: Promise<{ orgId: string; teamId: string }>;
}

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId: routeOrgId, teamId } = await params;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team || team.organizationId !== routeOrgId) notFound();

	const canManage = team.currentUser.canManage;
	const canManageAdmins = team.currentUser.canManageAdmins;
	const openPostCount = team.lfgPosts.filter((post) => post.status === "open").length;

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			<Button asChild variant="ghost" size="sm" className="-ml-2">
				<Link href={dashboardRoutes.workspace.orgById(team.organizationId)}>
					<HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="mr-1 size-4" />
					Back to org
				</Link>
			</Button>

			<div className="flex items-start gap-4">
				<Avatar className="size-12 overflow-hidden rounded-none after:rounded-none">
					<AvatarImage src={team.avatarUrl ?? undefined} className="rounded-none" />
					<AvatarFallback className="rounded-none text-sm font-bold">{team.tag}</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h1 className="text-lg font-bold">{team.name}</h1>
						<span className="font-mono text-xs text-muted-foreground">[{team.tag}]</span>
						{team.isArchived && (
							<Badge variant="outline" className="text-[10px]">
								Archived
							</Badge>
						)}
					</div>
					<p className="text-xs text-muted-foreground">
						SR {team.teamSr} · {team.matchesPlayed} scrims played
					</p>
					{team.description && (
						<p className="mt-1 text-sm text-muted-foreground">{team.description}</p>
					)}
				</div>
			</div>

			<Tabs defaultValue="overview" className="space-y-4">
				<TabsList variant="line">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="roster">Roster</TabsTrigger>
					{canManage && <TabsTrigger value="requests">Requests & Invites</TabsTrigger>}
					{canManage && <TabsTrigger value="applications">Applications</TabsTrigger>}
					{(canManage || team.currentUser.canLeave) && (
						<TabsTrigger value="settings">Settings</TabsTrigger>
					)}
				</TabsList>

				<TabsContent value="overview" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Team overview</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-3 sm:grid-cols-4">
							<div className="border p-4">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Roster</p>
								<p className="mt-2 text-2xl font-semibold">{team.activeRosterCount}</p>
							</div>
							<div className="border p-4">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Admins</p>
								<p className="mt-2 text-2xl font-semibold">{team.adminCount}</p>
							</div>
							<div className="border p-4">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Invites</p>
								<p className="mt-2 text-2xl font-semibold">{team.pendingInvites.length}</p>
							</div>
							<div className="border p-4">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
									Requests
								</p>
								<p className="mt-2 text-2xl font-semibold">{team.pendingJoinRequests.length}</p>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-3">
							<CardTitle className="text-sm">Recruiting</CardTitle>
						</CardHeader>
						<CardContent>
							{canManage ? (
								<RecruitingToggle teamId={team.id} isRecruiting={team.isRecruiting} />
							) : (
								<Badge variant={team.isRecruiting ? "secondary" : "outline"}>
									{team.isRecruiting ? "Recruiting" : "Not recruiting"}
								</Badge>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Team admins</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							{team.admins.map((admin) => (
								<div
									key={`${admin.source}-${admin.userId}`}
									className="flex items-center gap-3 border px-3 py-2"
								>
									<Avatar className="size-8 overflow-hidden rounded-none after:rounded-none">
										<AvatarImage src={admin.avatarUrl ?? undefined} className="rounded-none" />
										<AvatarFallback className="rounded-none text-[10px] font-bold">
											{admin.displayName.slice(0, 2).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0 flex-1">
										<p className="truncate text-xs font-medium">{admin.displayName}</p>
										<p className="text-[11px] text-muted-foreground capitalize">
											{admin.source === "organization"
												? `${admin.orgRole} admin`
												: `${admin.permissionRole} access`}
										</p>
									</div>
								</div>
							))}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="roster" className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium">Roster</p>
							<p className="text-xs text-muted-foreground">
								Manage players, roles, and delegated admins.
							</p>
						</div>
						{canManage && (
							<div className="flex gap-2">
								<InvitePlayerDialog teamId={team.id} canManageAdmins={canManageAdmins}>
									<Button size="sm" variant="outline">
										<HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="mr-1.5 size-4" />
										Invite
									</Button>
								</InvitePlayerDialog>
								<AddPlayerDialog teamId={team.id} canManageAdmins={canManageAdmins}>
									<Button size="sm" variant="outline">
										<HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} className="mr-1.5 size-4" />
										Add player
									</Button>
								</AddPlayerDialog>
							</div>
						)}
					</div>
					<RosterTable
						roster={team.roster}
						canManage={canManage}
						canManageAdmins={canManageAdmins}
						teamId={team.id}
					/>
				</TabsContent>

				{canManage && (
					<TabsContent value="requests" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle className="text-sm">Join requests</CardTitle>
							</CardHeader>
							<CardContent>
								<TeamJoinRequestsSection teamId={team.id} requests={team.pendingJoinRequests} />
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle className="text-sm">Pending invites</CardTitle>
							</CardHeader>
							<CardContent>
								<TeamInvitesSection teamId={team.id} invites={team.pendingInvites} />
							</CardContent>
						</Card>
					</TabsContent>
				)}

				{canManage && (
					<TabsContent value="applications" className="space-y-4">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between pb-3">
								<CardTitle className="text-sm">LFG applications</CardTitle>
								<span className="text-xs text-muted-foreground">
									{openPostCount} open post{openPostCount === 1 ? "" : "s"}
								</span>
							</CardHeader>
							<CardContent>
								<TeamApplicationsSection applications={team.applications} teamId={team.id} />
							</CardContent>
						</Card>
					</TabsContent>
				)}

				{(canManage || team.currentUser.canLeave) && (
					<TabsContent value="settings">
						<TeamSettingsPanel team={team} />
					</TabsContent>
				)}
			</Tabs>
		</div>
	);
}
