import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSection } from "@/components/dashboard/page-section";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { TeamCard } from "@/components/teams/team-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
		<PageContainer>
			<PageHeader
				title={org.name}
				description={org.description || `/${org.slug}`}
				badge={
					<Badge variant="outline" className="text-[10px]">
						{ROLE_LABELS[org.currentUser.role ?? "member"] ?? org.currentUser.role}
					</Badge>
				}
			>
				<div className="flex items-center gap-3 pt-1">
					<Avatar className="size-10 overflow-hidden rounded-none after:rounded-none">
						<AvatarImage src={org.avatarUrl ?? undefined} className="rounded-none" />
						<AvatarFallback className="rounded-none text-xs font-bold">
							{org.name.substring(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					{org.description && <p className="text-xs text-muted-foreground">/{org.slug}</p>}
				</div>
			</PageHeader>

			<StatsGrid
				stats={[
					{ label: "Teams", value: totalTeams },
					{ label: "Members", value: org.members.length },
					{ label: "Open posts", value: openPostCount },
					{ label: "Conversations", value: org.conversations.length },
				]}
			/>

			<PageSection
				title="Active teams"
				actions={
					canManage ? (
						<CreateTeamDialog orgId={org.id}>
							<Button size="sm" variant="outline">
								<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
								New team
							</Button>
						</CreateTeamDialog>
					) : undefined
				}
			>
				{org.activeTeams.length === 0 ? (
					<EmptyStateBlock
						title="No active teams yet"
						description="Create your first team to start organizing scrims."
						variant="card"
					/>
				) : (
					<div className="grid gap-3 sm:grid-cols-2">
						{org.activeTeams.map((team) => (
							<TeamCard key={team.id} team={team} orgId={org.id} />
						))}
					</div>
				)}
			</PageSection>
		</PageContainer>
	);
}
