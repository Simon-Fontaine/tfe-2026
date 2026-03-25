import { ArrowRight01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getUserOrgRole } from "@/lib/data/organization";
import { getPublicTeamPreview } from "@/lib/data/team";

export default async function TeamProfilePage({ params }: { params: Promise<{ teamId: string }> }) {
	const { teamId } = await params;
	const team = await getPublicTeamPreview(teamId);
	if (!team) notFound();

	const { user } = await getCurrentSession();
	const userOrgRole = user
		? await getUserOrgRole(team.organizationId, user.id).catch(() => null)
		: null;
	const canManageInDashboard = userOrgRole === "owner" || userOrgRole === "manager";

	return (
		<div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
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
						</div>
					</div>
				</div>
			</div>

			<div className="border p-5">
				<h2 className="text-sm font-semibold">Apply</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					{team.isRecruiting
						? "This team is currently recruiting. Browse open LFG posts and submit an application."
						: "This team is not actively recruiting right now. Check back later for open opportunities."}
				</p>
				<div className="mt-3 flex flex-wrap gap-2">
					{team.isRecruiting || team.hasOpenRolePost ? (
						<Button asChild size="sm">
							<Link href="/dashboard/recruit/teams">
								Find open team posts
								<HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="ml-1 size-4" />
							</Link>
						</Button>
					) : (
						<Button size="sm" disabled>
							No openings yet
						</Button>
					)}
					{canManageInDashboard && (
						<Button asChild size="sm" variant="outline">
							<Link href={`/dashboard/workspace/orgs/${team.organizationId}/teams/${team.id}`}>
								Manage in dashboard
							</Link>
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
