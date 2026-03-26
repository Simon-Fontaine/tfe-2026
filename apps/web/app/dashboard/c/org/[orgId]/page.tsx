import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";

import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { TeamCard } from "@/components/teams/team-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";

const ROLE_LABELS: Record<string, string> = {
	owner: "Owner",
	admin: "Admin",
	member: "Member",
};

export default async function OrgOverviewPage({ params }: { params: Promise<{ orgId: string }> }) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId } = await params;
	const org = await getOrgWithTeams(orgId, user.id);
	if (!org) notFound();

	const canManage = org.currentUser.canManage;
	const totalTeams = org.activeTeams.length + org.archivedTeams.length;
	const openPostCount = org.ownedPosts.filter((post) => post.status === "open").length;

	return (
		<>
			{/* Org header */}
			<div className="flex items-center gap-4">
				<Avatar className="size-14 overflow-hidden rounded-none after:rounded-none">
					<AvatarImage src={org.avatarUrl ?? undefined} className="rounded-none" />
					<AvatarFallback className="rounded-none text-sm font-bold">
						{org.name.substring(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h1 className="text-lg font-bold">{org.name}</h1>
						<Badge variant="outline" className="text-[10px]">
							{ROLE_LABELS[org.currentUser.role ?? "member"] ?? org.currentUser.role}
						</Badge>
					</div>
					<p className="text-xs text-muted-foreground">/{org.slug}</p>
					{org.description && (
						<p className="mt-1 text-sm text-muted-foreground">{org.description}</p>
					)}
				</div>
			</div>

			{/* Stats */}
			<div className="grid gap-3 sm:grid-cols-4">
				<Card>
					<CardContent className="pt-4">
						<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Teams</p>
						<p className="mt-1 text-2xl font-semibold">{totalTeams}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4">
						<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Members</p>
						<p className="mt-1 text-2xl font-semibold">{org.members.length}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4">
						<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Open posts</p>
						<p className="mt-1 text-2xl font-semibold">{openPostCount}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-4">
						<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
							Conversations
						</p>
						<p className="mt-1 text-2xl font-semibold">{org.conversations.length}</p>
					</CardContent>
				</Card>
			</div>

			{/* Active teams */}
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
		</>
	);
}
