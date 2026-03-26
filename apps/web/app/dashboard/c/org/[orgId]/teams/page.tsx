import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";

import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { TeamCard } from "@/components/teams/team-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";

export default async function OrgTeamsPage({ params }: { params: Promise<{ orgId: string }> }) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId } = await params;
	const org = await getOrgWithTeams(orgId, user.id);
	if (!org) notFound();

	const canManage = org.currentUser.canManage;

	return (
		<>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-bold">Teams</h1>
					<p className="text-xs text-muted-foreground">
						Manage active and archived rosters for {org.name}.
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
		</>
	);
}
