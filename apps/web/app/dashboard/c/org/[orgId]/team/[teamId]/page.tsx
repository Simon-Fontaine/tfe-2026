import { notFound } from "next/navigation";

import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSection } from "@/components/dashboard/page-section";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { RecruitingToggle } from "@/components/teams/recruiting-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
		<PageContainer>
			<PageHeader
				title={team.name}
				description={`SR ${team.teamSr} · ${team.matchesPlayed} scrims played`}
				badge={
					<>
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
					</>
				}
			>
				{team.description && <p className="text-xs text-muted-foreground">{team.description}</p>}
			</PageHeader>

			<StatsGrid
				stats={[
					{ label: "Players", value: team.players.length },
					{ label: "Staff", value: team.staff.length },
					{ label: "Invites", value: team.pendingInvites.length },
					{ label: "Open posts", value: openPostCount },
				]}
			/>

			<PageSection title="Recruiting">
				{canManage ? (
					<RecruitingToggle teamId={team.id} isRecruiting={team.isRecruiting} />
				) : (
					<Badge variant={team.isRecruiting ? "secondary" : "outline"}>
						{team.isRecruiting ? "Recruiting" : "Not recruiting"}
					</Badge>
				)}
			</PageSection>

			<PageSection title="Team admins">
				<div className="space-y-2">
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
				</div>
			</PageSection>
		</PageContainer>
	);
}
