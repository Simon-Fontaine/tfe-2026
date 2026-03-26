import { notFound } from "next/navigation";

import { RecruitingToggle } from "@/components/teams/recruiting-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth/session";
import { getTeamWithRoster } from "@/lib/data/teams";

interface TeamOverviewPageProps {
	params: Promise<{ orgId: string; teamId: string }>;
}

export default async function TeamOverviewPage({ params }: TeamOverviewPageProps) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId, teamId } = await params;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team || team.organizationId !== orgId) notFound();

	const canManage = team.currentUser.canManage;
	const openPostCount = team.ownedPosts.filter((post) => post.status === "open").length;

	return (
		<>
			{/* Team header */}
			<div className="flex items-start gap-4">
				<Avatar className="size-14 overflow-hidden rounded-none after:rounded-none">
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
						{team.isRecruiting && (
							<Badge variant="secondary" className="text-[10px] text-green-600">
								Recruiting
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

			{/* Stats */}
			<div className="grid gap-3 sm:grid-cols-4">
				<Card>
					<CardContent className="pt-4">
						<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Players</p>
						<p className="mt-1 text-2xl font-semibold">{team.players.length}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4">
						<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Staff</p>
						<p className="mt-1 text-2xl font-semibold">{team.staff.length}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4">
						<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Invites</p>
						<p className="mt-1 text-2xl font-semibold">{team.pendingInvites.length}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4">
						<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Open posts</p>
						<p className="mt-1 text-2xl font-semibold">{openPostCount}</p>
					</CardContent>
				</Card>
			</div>

			{/* Recruiting */}
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

			{/* Team admins */}
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
		</>
	);
}
