import { ArrowRight01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RecruitmentPostCard } from "@/components/recruit/recruitment-post-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getUserOrgRole } from "@/lib/data/organization";
import { getManageableRecruitEntities } from "@/lib/data/recruit";
import { getPublicTeamPreview } from "@/lib/data/team";

export default async function TeamProfilePage({ params }: { params: Promise<{ teamId: string }> }) {
	const { teamId } = await params;
	const team = await getPublicTeamPreview(teamId);
	if (!team) notFound();

	const { user } = await getCurrentSession();
	const userOrgRole = user
		? await getUserOrgRole(team.organizationId, user.id).catch(() => null)
		: null;
	const canManageInDashboard = userOrgRole === "owner" || userOrgRole === "admin";
	const isOrgMember = userOrgRole !== null;
	const entityOptions = user ? await getManageableRecruitEntities(user.id) : [];

	return (
		<div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
			<div className="border p-5">
				<div className="flex items-start gap-4">
					<Avatar className="size-14 shrink-0 overflow-hidden rounded-none after:rounded-none">
						<AvatarImage src={team.avatarUrl ?? undefined} className="rounded-none" />
						<AvatarFallback className="rounded-none text-sm font-bold">{team.tag}</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1 space-y-2">
						<div className="flex items-center gap-2">
							<h1 className="text-lg font-bold sm:text-xl">{team.name}</h1>
							<span className="font-mono text-xs text-muted-foreground">[{team.tag}]</span>
						</div>
						<p className="text-xs text-muted-foreground">
							SR {team.teamSr} · {team.matchesPlayed} scrims played
						</p>
						{team.description && (
							<p className="text-sm text-muted-foreground">{team.description}</p>
						)}
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant={team.isRecruiting ? "secondary" : "outline"}>
								{team.isRecruiting ? "Recruiting" : "Not recruiting"}
							</Badge>
							<span className="flex items-center gap-1 text-xs text-muted-foreground">
								<HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-3" />
								{team.activeRosterCount} active member{team.activeRosterCount === 1 ? "" : "s"}
							</span>
							{team.openPostCount > 0 && (
								<Badge variant="outline" className="text-[10px]">
									{team.openPostCount} open post{team.openPostCount === 1 ? "" : "s"}
								</Badge>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className="border p-5">
				<h2 className="text-sm font-semibold">Recruiting</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					Use the team’s public recruiting posts below instead of request-to-join forms or Discord
					channels.
				</p>
				<div className="mt-3 flex flex-wrap gap-2">
					<Button asChild size="sm">
						<Link href="/posts">
							Browse all posts
							<HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="ml-1 size-4" />
						</Link>
					</Button>
					{isOrgMember && (
						<Button asChild size="sm" variant="outline">
							<Link href={`/dashboard/workspace/orgs/${team.organizationId}/teams/${team.id}`}>
								{canManageInDashboard ? "Manage in dashboard" : "Open workspace"}
							</Link>
						</Button>
					)}
				</div>
			</div>

			<div className="space-y-4">
				<div>
					<h2 className="text-sm font-semibold">Open posts</h2>
					<p className="text-xs text-muted-foreground">
						Current opportunities published directly by this team.
					</p>
				</div>
				{team.posts.length === 0 ? (
					<div className="border border-dashed px-6 py-10 text-center">
						<p className="text-sm font-medium">No open posts right now</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Check back later or browse other public recruiting posts.
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{team.posts.map((post) => (
							<RecruitmentPostCard
								key={post.id}
								post={post}
								currentUserId={user?.id ?? null}
								entityOptions={entityOptions}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
