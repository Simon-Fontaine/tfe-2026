import { Add01Icon, ArrowLeft01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InviteMemberDialog } from "@/components/orgs/invite-member-dialog";
import { MemberActionsDropdown } from "@/components/orgs/member-actions-dropdown";
import { OrgPendingInvitesSection } from "@/components/orgs/org-pending-invites-section";
import { OrgSettingsPanel } from "@/components/orgs/org-settings-panel";
import { RecruitmentPostCard } from "@/components/recruit/recruitment-post-card";
import { RecruitmentPostFormDialog } from "@/components/recruit/recruitment-post-form-dialog";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { TeamCard } from "@/components/teams/team-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";
import { getRecruitmentResponsesForPost } from "@/lib/data/recruit";
import { dashboardRoutes } from "@/lib/routes";

const ROLE_LABELS: Record<string, string> = {
	owner: "Owner",
	admin: "Admin",
	member: "Member",
};

export default async function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId } = await params;
	const org = await getOrgWithTeams(orgId, user.id);
	if (!org) notFound();

	const canManage = org.currentUser.canManage;
	const totalTeams = org.activeTeams.length + org.archivedTeams.length;
	const openPostCount = org.ownedPosts.filter((post) => post.status === "open").length;
	const responsesByPost = new Map(
		await Promise.all(
			org.ownedPosts.map(
				async (post) => [post.id, await getRecruitmentResponsesForPost(post.id)] as const
			)
		)
	);

	return (
		<div className="space-y-6">
			<Button asChild variant="ghost" size="sm" className="-ml-2 mt-0.5">
				<Link href={dashboardRoutes.workspace.orgs}>
					<HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="mr-1 size-4" />
					Workspace
				</Link>
			</Button>

			<div className="flex items-center gap-4">
				<Avatar className="size-14 overflow-hidden rounded-none after:rounded-none">
					<AvatarImage src={org.avatarUrl ?? undefined} className="rounded-none" />
					<AvatarFallback className="rounded-none text-sm font-bold">
						{org.name.substring(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<h1 className="text-lg font-bold">{org.name}</h1>
					<p className="text-xs text-muted-foreground">/{org.slug}</p>
					{org.description && (
						<p className="mt-1 text-sm text-muted-foreground">{org.description}</p>
					)}
					<div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
						<span>{totalTeams} teams</span>
						<span>{org.members.length} members</span>
						<span>{openPostCount} open posts</span>
						<Badge variant="outline" className="text-[10px]">
							{ROLE_LABELS[org.currentUser.role ?? "member"] ?? org.currentUser.role}
						</Badge>
					</div>
				</div>
			</div>

			<Tabs defaultValue="overview" className="space-y-4">
				<TabsList variant="line">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="teams">Teams</TabsTrigger>
					<TabsTrigger value="members">Members</TabsTrigger>
					<TabsTrigger value="posts">Posts</TabsTrigger>
					<TabsTrigger value="conversations">Conversations</TabsTrigger>
					<TabsTrigger value="invitations">Invitations</TabsTrigger>
					{(canManage || org.currentUser.canLeave || org.currentUser.canDelete) && (
						<TabsTrigger value="settings">Settings</TabsTrigger>
					)}
				</TabsList>

				<TabsContent value="overview" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Overview</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-3 sm:grid-cols-4">
							<div className="border p-4">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Teams</p>
								<p className="mt-2 text-2xl font-semibold">{totalTeams}</p>
							</div>
							<div className="border p-4">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Members</p>
								<p className="mt-2 text-2xl font-semibold">{org.members.length}</p>
							</div>
							<div className="border p-4">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
									Open posts
								</p>
								<p className="mt-2 text-2xl font-semibold">{openPostCount}</p>
							</div>
							<div className="border p-4">
								<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
									Conversations
								</p>
								<p className="mt-2 text-2xl font-semibold">{org.conversations.length}</p>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-3">
							<CardTitle className="text-sm">Active teams</CardTitle>
							{canManage && (
								<CreateTeamDialog orgId={org.id}>
									<Button size="sm" variant="outline">
										<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
										New team
									</Button>
								</CreateTeamDialog>
							)}
						</CardHeader>
						<CardContent>
							{org.activeTeams.length === 0 ? (
								<p className="text-xs text-muted-foreground">No active teams yet.</p>
							) : (
								<div className="grid gap-3 sm:grid-cols-2">
									{org.activeTeams.map((team) => (
										<TeamCard key={team.id} team={team} orgId={org.id} />
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="teams" className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium">Teams</p>
							<p className="text-xs text-muted-foreground">
								Manage active and archived rosters from the same organisation workspace.
							</p>
						</div>
						{canManage && (
							<CreateTeamDialog orgId={org.id}>
								<Button size="sm">
									<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
									New team
								</Button>
							</CreateTeamDialog>
						)}
					</div>

					<Card>
						<CardHeader>
							<CardTitle className="text-sm">Active teams</CardTitle>
						</CardHeader>
						<CardContent>
							{org.activeTeams.length === 0 ? (
								<p className="text-xs text-muted-foreground">No active teams.</p>
							) : (
								<div className="grid gap-3 sm:grid-cols-2">
									{org.activeTeams.map((team) => (
										<TeamCard key={team.id} team={team} orgId={org.id} />
									))}
								</div>
							)}
						</CardContent>
					</Card>

					{org.archivedTeams.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="text-sm">Archived teams</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid gap-3 sm:grid-cols-2">
									{org.archivedTeams.map((team) => (
										<TeamCard key={team.id} team={team} orgId={org.id} />
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				<TabsContent value="members" className="space-y-4">
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
								<div key={member.id} className="flex items-center gap-3 border px-3 py-3">
									<Avatar className="size-8 overflow-hidden rounded-none after:rounded-none">
										<AvatarImage src={member.avatarUrl ?? undefined} className="rounded-none" />
										<AvatarFallback className="rounded-none text-[10px] font-bold">
											{member.displayName.slice(0, 2).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0 flex-1">
										<p className="truncate text-xs font-medium">{member.displayName}</p>
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
									{canManage && member.userId !== user.id && (
										<MemberActionsDropdown
											orgId={org.id}
											member={member}
											viewerRole={org.currentUser.role ?? "member"}
										/>
									)}
								</div>
							))}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="posts" className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium">Organisation posts</p>
							<p className="text-xs text-muted-foreground">
								Publish staff openings or other organisation-owned recruiting needs.
							</p>
						</div>
						{canManage && (
							<RecruitmentPostFormDialog fixedOwnerType="organization" fixedOrganizationId={org.id}>
								<Button size="sm">
									<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
									New post
								</Button>
							</RecruitmentPostFormDialog>
						)}
					</div>

					{org.ownedPosts.length === 0 ? (
						<div className="border border-dashed px-6 py-10 text-center">
							<p className="text-sm font-medium">No organisation posts yet</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Post staff openings here instead of relying on Discord channels.
							</p>
						</div>
					) : (
						<div className="space-y-4">
							{org.ownedPosts.map((post) => (
								<RecruitmentPostCard
									key={post.id}
									post={post}
									currentUserId={user.id}
									responses={responsesByPost.get(post.id) ?? []}
									organizationId={org.id}
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
							{org.conversations.length === 0 ? (
								<p className="text-xs text-muted-foreground">
									No recruiting conversations have started for this organisation yet.
								</p>
							) : (
								<div className="space-y-2">
									{org.conversations.map((conversation) => (
										<Link
											key={conversation.threadId}
											href={`${dashboardRoutes.recruit.conversations}?thread=${conversation.threadId}`}
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
							<OrgPendingInvitesSection orgId={org.id} invites={org.pendingInvites} />
						</CardContent>
					</Card>
				</TabsContent>

				{(canManage || org.currentUser.canLeave || org.currentUser.canDelete) && (
					<TabsContent value="settings">
						<OrgSettingsPanel org={org} />
					</TabsContent>
				)}
			</Tabs>
		</div>
	);
}
