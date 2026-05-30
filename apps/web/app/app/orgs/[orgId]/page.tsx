import { MoreHorizontalIcon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccessGate } from "@/components/workspace/access-gate";
import { AttentionQueue, type AttentionQueueItem } from "@/components/workspace/attention-queue";
import { PageContainer } from "@/components/workspace/page-container";
import { getOrgWithTeamsRouteState } from "@/lib/data/orgs";
import { appRoutes, publicRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

const ROLE_LABELS: Record<string, string> = {
	owner: "Owner",
	admin: "Admin",
	member: "Member",
};

const MEMBER_TYPE_LABELS: Record<string, string> = {
	player: "Player",
	staff: "Staff",
};

function formatRole(value: string | null | undefined) {
	if (!value) return "Member";
	return ROLE_LABELS[value] ?? value;
}

function formatDate(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Unknown";
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(date);
}

export default async function AppOrgOverviewPage({
	params,
}: {
	params: Promise<{ orgId: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { orgId } = await params;
	const org = await getOrgWithTeamsRouteState(orgId, user.id);
	if (org.kind === "missing") notFound();
	if (org.kind !== "success") {
		return <AccessGate title="Organization" resourceType="organization" />;
	}
	const orgDetail = org.data;

	const openListingCount = orgDetail.ownedListings.filter((post) => post.status === "open").length;
	const roleLabel = formatRole(orgDetail.currentUser.role);
	const attentionItems: AttentionQueueItem[] = orgDetail.activeTeams
		.flatMap((team) =>
			(team.oversight?.signals ?? [])
				.filter((signal) => signal.severity === "critical" || signal.severity === "warning")
				.slice(0, 2)
				.map((signal) => ({
					id: `${team.id}-${signal.code}`,
					title: `${team.name}: ${signal.label}`,
					objectType: "team oversight",
					contextLabel: orgDetail.name,
					statusText: signal.severity === "critical" ? "Needs action" : "Watch",
					timestamp: signal.at ?? team.oversight?.latestActivityAt ?? null,
					priority: signal.severity === "critical" ? 1 : 2,
					actionLabel: team.oversight?.canOpenWorkspace ? "Open team" : "View teams",
					href: team.oversight?.canOpenWorkspace
						? appRoutes.teams.byId(team.id)
						: appRoutes.orgs.teams(orgDetail.id),
					prefetch: false,
					permissionCopy: team.oversight?.autonomyCopy,
				}))
		)
		.slice(0, 12);

	return (
		<PageContainer>
			<PageHeader
				title={orgDetail.name}
				breadcrumbs={
					<>
						<Link href={appRoutes.orgs.root} className="hover:underline">
							Orgs
						</Link>
						{" / "}
						{orgDetail.name}
					</>
				}
				meta={`${roleLabel} - /${orgDetail.slug} - ${orgDetail.activeTeams.length} active teams - ${orgDetail.members.length} members - ${openListingCount} open listings - ${orgDetail.pendingInvites.length} pending invites`}
				action={
					orgDetail.currentUser.canManage ? (
						<CreateTeamDialog orgId={orgDetail.id} showTrigger />
					) : undefined
				}
			/>

			<section className="space-y-4">
				<h2 className="mb-4 border-b pb-2 text-lg font-semibold">Operational attention</h2>
				<AttentionQueue items={attentionItems} />
			</section>

			<section className="space-y-4">
				<h2 className="mb-4 border-b pb-2 text-lg font-semibold">Active teams</h2>
				{orgDetail.activeTeams.length === 0 ? (
					<EmptyState
						icon={UserGroupIcon}
						title="No active teams"
						action={
							orgDetail.currentUser.canManage ? (
								<CreateTeamDialog orgId={orgDetail.id} showTrigger />
							) : undefined
						}
					/>
				) : (
					<div className="overflow-hidden border">
						<div className="grid grid-cols-[minmax(12rem,1.6fr)_repeat(4,minmax(6rem,1fr))_3rem] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
							<span>Team</span>
							<span>Rating</span>
							<span>Roster</span>
							<span>Scrims</span>
							<span>Status</span>
							<span className="text-right">Actions</span>
						</div>
						<div className="divide-y">
							{orgDetail.activeTeams.map((team) => {
								const canOpenWorkspace = team.oversight?.canOpenWorkspace ?? false;
								const activeRosterCount =
									team.oversight?.activeRosterCount ?? team.activeRosterCount;
								const upcomingScrimCount = team.oversight?.upcomingScrimCount ?? 0;
								const visibility = team.oversight?.visibility === "private" ? "Private" : "Public";

								return (
									<div
										key={team.id}
										className="grid grid-cols-[minmax(12rem,1.6fr)_repeat(4,minmax(6rem,1fr))_3rem] gap-3 px-4 py-3 text-sm"
									>
										<div className="min-w-0">
											<p className="truncate font-medium">{team.name}</p>
											<p className="text-xs text-muted-foreground">{team.tag}</p>
											{!canOpenWorkspace && team.oversight?.autonomyCopy ? (
												<p className="mt-1 text-xs text-muted-foreground">
													{team.oversight.autonomyCopy}
												</p>
											) : null}
										</div>
										<span>{team.rating}</span>
										<span>{activeRosterCount} active</span>
										<span>{upcomingScrimCount} upcoming</span>
										<span>
											<Badge variant="outline">{visibility}</Badge>
										</span>
										<div className="flex justify-end">
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button size="icon-sm" variant="ghost" aria-label="Team actions">
														<HugeiconsIcon
															icon={MoreHorizontalIcon}
															strokeWidth={2}
															className="size-4"
														/>
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													{canOpenWorkspace ? (
														<DropdownMenuItem asChild>
															<Link href={appRoutes.teams.byId(team.id)}>Open team</Link>
														</DropdownMenuItem>
													) : (
														<DropdownMenuItem asChild>
															<Link href={appRoutes.orgs.teams(orgDetail.id)}>View teams</Link>
														</DropdownMenuItem>
													)}
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</section>

			<section className="space-y-4">
				<h2 className="mb-4 border-b pb-2 text-lg font-semibold">Staff</h2>
				{orgDetail.members.length === 0 ? (
					<EmptyState icon={UserGroupIcon} title="No members" />
				) : (
					<div className="overflow-hidden border">
						<div className="grid grid-cols-[minmax(12rem,1.6fr)_repeat(3,minmax(7rem,1fr))_3rem] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
							<span>Member</span>
							<span>Role</span>
							<span>Type</span>
							<span>Joined</span>
							<span className="text-right">Actions</span>
						</div>
						<div className="divide-y">
							{orgDetail.members.map((member) => (
								<div
									key={member.id}
									className="grid grid-cols-[minmax(12rem,1.6fr)_repeat(3,minmax(7rem,1fr))_3rem] gap-3 px-4 py-3 text-sm"
								>
									<div className="min-w-0">
										<p className="truncate font-medium">{member.displayName}</p>
										<p className="text-xs text-muted-foreground">@{member.username}</p>
									</div>
									<span>
										<Badge variant="outline">{formatRole(member.role)}</Badge>
									</span>
									<span>
										<Badge variant="outline">
											{MEMBER_TYPE_LABELS[member.memberType] ?? member.memberType}
										</Badge>
									</span>
									<span>{formatDate(member.joinedAt)}</span>
									<div className="flex justify-end">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button size="icon-sm" variant="ghost" aria-label="Member actions">
													<HugeiconsIcon
														icon={MoreHorizontalIcon}
														strokeWidth={2}
														className="size-4"
													/>
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem asChild>
													<Link href={publicRoutes.players.byUsername(member.username)}>
														View profile
													</Link>
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</section>
		</PageContainer>
	);
}
