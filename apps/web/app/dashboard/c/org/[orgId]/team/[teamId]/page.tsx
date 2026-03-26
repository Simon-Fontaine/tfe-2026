import { Add01Icon, ArrowLeft01Icon, Mail01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RecruitmentPostCard } from "@/components/recruit/recruitment-post-card";
import { RecruitmentPostFormDialog } from "@/components/recruit/recruitment-post-form-dialog";
import { AddPlayerDialog } from "@/components/teams/add-player-dialog";
import { InvitePlayerDialog } from "@/components/teams/invite-player-dialog";
import { RecruitingToggle } from "@/components/teams/recruiting-toggle";
import { RosterTable } from "@/components/teams/roster-table";
import { TeamInvitesSection } from "@/components/teams/team-invites-section";
import { TeamSettingsPanel } from "@/components/teams/team-settings-panel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentSession } from "@/lib/auth/session";
import { getRecruitmentResponsesForPost } from "@/lib/data/recruit";
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
	const openPostCount = team.ownedPosts.filter((post) => post.status === "open").length;
	const responsesByPost = new Map(
		await Promise.all(
			team.ownedPosts.map(
				async (post) => [post.id, await getRecruitmentResponsesForPost(post.id)] as const
			)
		)
	);

	return (
		<div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
			<Button asChild variant="ghost" size="sm" className="-ml-2">
				<Link href={dashboardRoutes.context.orgById(team.organizationId)}>
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
					<TabsTrigger value="players">Players</TabsTrigger>
					<TabsTrigger value="staff">Staff</TabsTrigger>
					<TabsTrigger value="posts">Posts</TabsTrigger>
					<TabsTrigger value="conversations">Conversations</TabsTrigger>
					<TabsTrigger value="invitations">Invitations</TabsTrigger>
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
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Players</p>
								<p className="mt-2 text-2xl font-semibold">{team.players.length}</p>
							</div>
							<div className="border p-4">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Staff</p>
								<p className="mt-2 text-2xl font-semibold">{team.staff.length}</p>
							</div>
							<div className="border p-4">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Invites</p>
								<p className="mt-2 text-2xl font-semibold">{team.pendingInvites.length}</p>
							</div>
							<div className="border p-4">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
									Open posts
								</p>
								<p className="mt-2 text-2xl font-semibold">{openPostCount}</p>
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
												? `${admin.orgRole} access`
												: `${admin.permissionRole} access`}
										</p>
									</div>
								</div>
							))}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="players" className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium">Players</p>
							<p className="text-xs text-muted-foreground">
								Manage rostered players, their roles, and delegated admin access.
							</p>
						</div>
						{canManage && (
							<div className="flex gap-2">
								<InvitePlayerDialog
									teamId={team.id}
									canManageAdmins={canManageAdmins}
									defaultMemberType="player"
									title="Invite player"
								>
									<Button size="sm" variant="outline">
										<HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="mr-1.5 size-4" />
										Invite player
									</Button>
								</InvitePlayerDialog>
								<AddPlayerDialog
									teamId={team.id}
									canManageAdmins={canManageAdmins}
									defaultMemberType="player"
									title="Add player"
								>
									<Button size="sm" variant="outline">
										<HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} className="mr-1.5 size-4" />
										Add player
									</Button>
								</AddPlayerDialog>
							</div>
						)}
					</div>
					<RosterTable
						roster={team.players}
						canManage={canManage}
						canManageAdmins={canManageAdmins}
						teamId={team.id}
						emptyLabel="No players on this team yet."
					/>
				</TabsContent>

				<TabsContent value="staff" className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium">Staff</p>
							<p className="text-xs text-muted-foreground">
								Manage coaches, analysts, and managers through the same team membership model.
							</p>
						</div>
						{canManage && (
							<div className="flex gap-2">
								<InvitePlayerDialog
									teamId={team.id}
									canManageAdmins={canManageAdmins}
									defaultMemberType="staff"
									title="Invite staff"
								>
									<Button size="sm" variant="outline">
										<HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="mr-1.5 size-4" />
										Invite staff
									</Button>
								</InvitePlayerDialog>
								<AddPlayerDialog
									teamId={team.id}
									canManageAdmins={canManageAdmins}
									defaultMemberType="staff"
									title="Add staff"
								>
									<Button size="sm" variant="outline">
										<HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} className="mr-1.5 size-4" />
										Add staff
									</Button>
								</AddPlayerDialog>
							</div>
						)}
					</div>
					<RosterTable
						roster={team.staff}
						canManage={canManage}
						canManageAdmins={canManageAdmins}
						teamId={team.id}
						emptyLabel="No staff members on this team yet."
					/>
				</TabsContent>

				<TabsContent value="posts" className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium">Team posts</p>
							<p className="text-xs text-muted-foreground">
								Publish openings for players, ringers, and team staff from this workspace.
							</p>
						</div>
						{canManage && (
							<RecruitmentPostFormDialog fixedOwnerType="team" fixedTeamId={team.id}>
								<Button size="sm">
									<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
									New post
								</Button>
							</RecruitmentPostFormDialog>
						)}
					</div>

					{team.ownedPosts.length === 0 ? (
						<div className="border border-dashed px-6 py-10 text-center">
							<p className="text-sm font-medium">No team posts yet</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Create a post here to replace Discord recruiting threads for this team.
							</p>
						</div>
					) : (
						<div className="space-y-4">
							{team.ownedPosts.map((post) => (
								<RecruitmentPostCard
									key={post.id}
									post={post}
									currentUserId={user.id}
									responses={responsesByPost.get(post.id) ?? []}
									teamId={team.id}
									organizationId={team.organizationId}
								/>
							))}
						</div>
					)}
				</TabsContent>

				<TabsContent value="conversations" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Recruit conversations</CardTitle>
						</CardHeader>
						<CardContent>
							{team.conversations.length === 0 ? (
								<p className="text-xs text-muted-foreground">
									No recruiting conversations have started for this team yet.
								</p>
							) : (
								<div className="space-y-2">
									{team.conversations.map((conversation) => (
										<Link
											key={conversation.threadId}
											href={`${dashboardRoutes.discover.conversations}?thread=${conversation.threadId}`}
											className="block border px-4 py-3 transition-colors hover:bg-muted/50"
										>
											<p className="text-sm font-medium">{conversation.counterpartLabel}</p>
											<p className="mt-1 text-xs text-muted-foreground">{conversation.postTitle}</p>
										</Link>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="invitations" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Pending invites</CardTitle>
						</CardHeader>
						<CardContent>
							<TeamInvitesSection teamId={team.id} invites={team.pendingInvites} />
						</CardContent>
					</Card>
				</TabsContent>

				{(canManage || team.currentUser.canLeave) && (
					<TabsContent value="settings">
						<TeamSettingsPanel team={team} />
					</TabsContent>
				)}
			</Tabs>
		</div>
	);
}
