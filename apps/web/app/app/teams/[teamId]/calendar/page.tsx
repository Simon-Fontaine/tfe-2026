import { Alert01Icon, Blockchain01Icon, Sword03Icon } from "@hugeicons/core-free-icons";
import type { ScrimStatus, ScrimSummary } from "@scrimflow/shared";
import { appRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import { TeamScheduleBoard } from "@/components/schedule/team/team-schedule-board";
import { ScrimStatusBadge } from "@/components/scrims/scrim-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { PageSection } from "@/components/workspace/page-section";
import { getPlayerAvailability } from "@/lib/data/player";
import { getTeamScrimsRouteState } from "@/lib/data/scrims";
import { getTeamScheduleRouteState, getTeamWithRosterRouteState } from "@/lib/data/teams";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

const UPCOMING_SCRIM_STATUSES: ScrimStatus[] = [
	"pending",
	"accepted",
	"scheduled",
	"in_progress",
	"awaiting_confirmation",
];

function formatScheduledAt(scheduledAt: string): string {
	const dt = new Date(scheduledAt);
	const main = new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(dt);
	const offset =
		new Intl.DateTimeFormat("en-GB", { timeZoneName: "shortOffset" })
			.formatToParts(dt)
			.find((p) => p.type === "timeZoneName")?.value ?? "UTC";
	return `${main} (${offset})`;
}

function UpcomingScrimsSection({
	scrimsForCalendar,
	teamId,
	currentTeamId,
}: {
	scrimsForCalendar: ScrimSummary[] | "error";
	teamId: string;
	currentTeamId: string;
}) {
	if (scrimsForCalendar === "error") {
		return (
			<PageSection title="Upcoming scrims">
				<EmptyState icon={Alert01Icon} title="Scrims could not be loaded. Refresh to retry." />
			</PageSection>
		);
	}

	if (scrimsForCalendar.length === 0) {
		return (
			<PageSection title="Upcoming scrims">
				<EmptyState
					icon={Sword03Icon}
					title="No upcoming scrims."
					action={
						<Button asChild size="sm" variant="outline">
							<Link href={appRoutes.teams.scrims(teamId)}>Go to scrims</Link>
						</Button>
					}
				/>
			</PageSection>
		);
	}

	return (
		<PageSection title="Upcoming scrims">
			<div className="space-y-2">
				{scrimsForCalendar.map((scrim) => {
					const isHomeTeam = scrim.homeTeam.id === currentTeamId;
					const opponent = isHomeTeam
						? scrim.awayTeam
							? `[${scrim.awayTeam.tag}] ${scrim.awayTeam.name}`
							: "Open opponent slot"
						: `[${scrim.homeTeam.tag}] ${scrim.homeTeam.name}`;

					const needsAction =
						scrim.status === "awaiting_confirmation" ||
						(scrim.status === "pending" && scrim.awayTeam?.id === currentTeamId);

					return (
						<div key={scrim.id} className="flex flex-wrap items-center gap-3 border px-4 py-3">
							<span className="min-w-0 flex-1 truncate font-medium text-sm">{opponent}</span>
							<ScrimStatusBadge status={scrim.status} />
							{needsAction && <Badge variant="default">Needs action</Badge>}
							<span className="text-sm text-muted-foreground">
								{scrim.scheduledAt
									? formatScheduledAt(scrim.scheduledAt)
									: "Scheduling in progress"}
							</span>
							<Button asChild size="sm" variant="outline">
								<Link href={appRoutes.teams.scrimById(teamId, scrim.id)}>Open scrim workspace</Link>
							</Button>
						</div>
					);
				})}
			</div>
		</PageSection>
	);
}

export default async function AppTeamCalendarPage({
	params,
}: {
	params: Promise<{ teamId: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { teamId } = await params;
	const team = await getTeamWithRosterRouteState(teamId, user.id);

	if (team.kind === "missing") notFound();
	if (team.kind !== "success") {
		return <AccessGate title="Team schedule" resourceType="team" />;
	}
	if (!team.data.currentUser.canViewSchedule) {
		return <AccessGate title="Team schedule" resourceType="team" />;
	}

	const [schedule, myAvailability] = await Promise.all([
		getTeamScheduleRouteState(teamId),
		getPlayerAvailability(user.id, teamId),
	]);

	const calendarBreadcrumbs = (
		<>
			<Link href="/app" className="hover:underline">
				Teams
			</Link>
			{" / "}
			<Link href={appRoutes.teams.byId(teamId)} className="hover:underline">
				{team.data.name}
			</Link>
			{" / Calendar"}
		</>
	);

	if (schedule.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader title="Calendar" breadcrumbs={calendarBreadcrumbs} />
				<EmptyState
					icon={schedule.kind === "no-access" ? Blockchain01Icon : Alert01Icon}
					title={
						schedule.kind === "no-access"
							? "You do not have permission to view this team's schedule."
							: "Team calendar could not be loaded."
					}
				/>
			</PageContainer>
		);
	}

	const scrimsResult = team.data.currentUser.canViewScrims
		? await getTeamScrimsRouteState(teamId).catch(() => ({ kind: "error" as const }))
		: null;

	let scrimsForCalendar: ScrimSummary[] | "error" | null = null;
	if (scrimsResult !== null) {
		if (scrimsResult.kind === "success") {
			const filtered = scrimsResult.data.scrims.filter((s) =>
				UPCOMING_SCRIM_STATUSES.includes(s.status)
			);
			filtered.sort((a, b) => {
				if (!a.scheduledAt && !b.scheduledAt) return 0;
				if (!a.scheduledAt) return 1;
				if (!b.scheduledAt) return -1;
				const diff = new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
				if (diff !== 0) return diff;
				return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
			});
			scrimsForCalendar = filtered;
		} else {
			scrimsForCalendar = "error";
		}
	}

	const teamOption = { id: team.data.id, name: team.data.name, tag: team.data.tag };

	return (
		<PageContainer>
			<PageHeader title="Calendar" breadcrumbs={calendarBreadcrumbs} />
			<div className="space-y-6">
				{scrimsForCalendar !== null && (
					<UpcomingScrimsSection
						scrimsForCalendar={scrimsForCalendar}
						teamId={teamId}
						currentTeamId={team.data.id}
					/>
				)}
				<TeamScheduleBoard schedule={schedule.data} currentUserId={user.id} />
				<ScheduleGrid availability={myAvailability} teams={[teamOption]} activeTeam={teamOption} />
			</div>
		</PageContainer>
	);
}
