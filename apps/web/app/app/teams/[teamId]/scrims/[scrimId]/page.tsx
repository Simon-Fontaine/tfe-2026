import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { appRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReportScrimResultDialog } from "@/components/scrims/report-scrim-result-dialog";
import { ScrimActivityFeed } from "@/components/scrims/scrim-activity-feed";
import { ScrimConfirmationSection } from "@/components/scrims/scrim-confirmation-section";
import { ScrimDetailRealtimeSync } from "@/components/scrims/scrim-detail-realtime-sync";
import { ScrimDetailTabs } from "@/components/scrims/scrim-detail-tabs";
import { ScrimMapsSection } from "@/components/scrims/scrim-maps-section";
import { ScrimNextStep } from "@/components/scrims/scrim-next-step";
import { ScrimOcrJobsPanel } from "@/components/scrims/scrim-ocr-jobs-panel";
import { ScrimOverviewSection } from "@/components/scrims/scrim-overview-section";
import { ScrimResultRevisions } from "@/components/scrims/scrim-result-revisions";
import { ScrimSummaryHeader } from "@/components/scrims/scrim-summary-header";
import { Button } from "@/components/ui/button";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { getScrimChatRouteState } from "@/lib/data/chat";
import { getScrimRouteState } from "@/lib/data/scrims";
import { getPublicTeamPreview, getTeamWithRosterRouteState } from "@/lib/data/teams";
import { deriveScrimViewModel } from "@/lib/scrims/view-model";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function TeamScrimDetailPage({
	params,
}: {
	params: Promise<{ teamId: string; scrimId: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const { teamId, scrimId } = await params;
	const teamState = await getTeamWithRosterRouteState(teamId, user.id);
	if (teamState.kind === "missing") notFound();
	if (teamState.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader
					title="Scrim detail"
					breadcrumbs={
						<Link href="/app" className="hover:underline">
							Teams
						</Link>
					}
				/>
				<EmptyState icon={Calendar03Icon} title="No access." />
			</PageContainer>
		);
	}
	if (!teamState.data.currentUser.canViewScrims) {
		return (
			<PageContainer>
				<PageHeader
					title="Scrim detail"
					breadcrumbs={
						<Link href="/app" className="hover:underline">
							Teams
						</Link>
					}
				/>
				<EmptyState icon={Calendar03Icon} title="No access." />
			</PageContainer>
		);
	}

	const [scrimState, chatConversationsState] = await Promise.all([
		getScrimRouteState(scrimId),
		getScrimChatRouteState(scrimId),
	]);

	if (scrimState.kind === "missing") notFound();
	if (scrimState.kind === "no-access") {
		return <AccessGate title="Scrim detail" resourceType="scrim" reason={scrimState.reason} />;
	}
	if (scrimState.kind === "wrong-context") {
		return (
			<PageContainer>
				<PageHeader
					title="Scrim detail"
					breadcrumbs={
						<>
							<Link href="/app" className="hover:underline">
								Teams
							</Link>
							{" / "}
							<Link href={appRoutes.teams.byId(teamState.data.id)} className="hover:underline">
								{teamState.data.name}
							</Link>
							{" / "}
							<Link href={appRoutes.teams.scrims(teamState.data.id)} className="hover:underline">
								Scrims
							</Link>
						</>
					}
				/>
				<EmptyState
					icon={Calendar03Icon}
					title="Scrim belongs to another team."
					action={
						<Button asChild size="sm" variant="outline">
							<Link href={appRoutes.teams.scrims(teamState.data.id)}>Back to scrim queue</Link>
						</Button>
					}
				/>
			</PageContainer>
		);
	}

	if (chatConversationsState.kind === "missing") notFound();

	const team = teamState.data;
	const scrim = scrimState.data;
	const availableChatConversations =
		chatConversationsState.kind === "success" ? chatConversationsState.data : [];

	const view = deriveScrimViewModel(scrim, {
		teamId: team.id,
		canManage: team.currentUser.canManage,
		orgRole: team.currentUser.orgRole,
	});

	// Scoreboard player stats can link to either team's roster. The opponent's
	// public roster lets managers attribute enemy stat rows too.
	const reportingTeamSide = team.id === scrim.homeTeam.id ? "home" : "away";
	const opponentTeamId =
		team.id === scrim.homeTeam.id ? (scrim.awayTeam?.id ?? null) : scrim.homeTeam.id;
	const opponentPreview = opponentTeamId ? await getPublicTeamPreview(opponentTeamId) : null;
	const byDisplayName = (a: { displayName: string }, b: { displayName: string }) =>
		a.displayName.localeCompare(b.displayName);
	const ownRoster = team.players
		.filter((player) => player.status !== "inactive")
		.map((player) => ({
			userId: player.userId,
			displayName: player.displayName,
			role: player.roleInTeam ?? player.gameRole ?? null,
			mainHero: player.mainHero?.displayName ?? "",
		}))
		.sort(byDisplayName);
	const opponentRoster = (opponentPreview?.roster ?? [])
		.filter((player) => player.status !== "inactive")
		.map((player) => ({
			userId: player.userId,
			displayName: player.displayName,
			role: player.roleInTeam ?? null,
			mainHero: "",
		}))
		.sort(byDisplayName);

	const homeDisplayTag = scrim.homeTeamSnapshot?.tag ?? scrim.homeTeam.tag;
	const homeDisplayName = scrim.homeTeamSnapshot?.name ?? scrim.homeTeam.name;
	const awayDisplayName = scrim.awayTeam
		? (scrim.awayTeamSnapshot?.name ?? scrim.awayTeam.name)
		: (scrim.awayTeamSnapshot?.name ?? null);
	const title = awayDisplayName
		? `[${homeDisplayTag}] ${homeDisplayName} vs ${awayDisplayName}`
		: `[${homeDisplayTag}] ${homeDisplayName} vs Open opponent`;
	const breadcrumbTitle = awayDisplayName
		? `${homeDisplayName} vs ${awayDisplayName}`
		: `${homeDisplayName} vs Open opponent`;

	const primaryChatConversation =
		availableChatConversations.find((c) => c.type === "scrim_lobby") ??
		availableChatConversations[0] ??
		null;
	// The chat entrypoint must stay stable across background refreshes, so it is
	// derived from whether the scrim has an opponent (deterministic) rather than
	// from the best-effort conversations fetch. Deep-link to the specific
	// conversation when we have it, otherwise fall back to the team chat workspace.
	const primaryChatHref = primaryChatConversation
		? `${appRoutes.teams.chat(team.id)}?conversation=${primaryChatConversation.id}`
		: scrim.awayTeam
			? appRoutes.teams.chat(team.id)
			: null;

	return (
		<PageContainer>
			<ScrimDetailRealtimeSync scrimId={scrim.id} />
			<PageHeader
				title={title}
				breadcrumbs={
					<>
						<Link href="/app" className="hover:underline">
							Teams
						</Link>
						{" / "}
						<Link href={appRoutes.teams.byId(team.id)} className="hover:underline">
							{team.name}
						</Link>
						{" / "}
						<Link href={appRoutes.teams.scrims(team.id)} className="hover:underline">
							Scrims
						</Link>
						{" / "}
						{breadcrumbTitle}
					</>
				}
			/>

			<ScrimSummaryHeader scrim={scrim} view={view} />

			<ScrimNextStep
				scrim={scrim}
				view={view}
				teamId={team.id}
				canManage={team.currentUser.canManage}
				primaryChatHref={primaryChatHref}
			/>

			<ScrimDetailTabs
				defaultTab={view.defaultTab}
				showResult={view.showResultTab}
				showConfirmations={view.showConfirmationsTab}
				overview={
					<ScrimOverviewSection
						scrim={scrim}
						view={view}
						teamId={team.id}
						teamTag={team.tag}
						teamName={team.name}
						canManage={team.currentUser.canManage}
						chatConversations={availableChatConversations}
						chatFallbackHref={scrim.awayTeam ? appRoutes.teams.chat(team.id) : null}
						scrimQueueHref={appRoutes.teams.scrims(team.id)}
					/>
				}
				result={
					<div className="space-y-4">
						<ScrimMapsSection
							maps={scrim.maps}
							scrimId={scrim.id}
							ocrJobs={scrim.ocrJobs}
							reportingTeamId={team.id}
							reportingTeamSide={reportingTeamSide}
							ownRoster={ownRoster}
							opponentRoster={opponentRoster}
							canManage={team.currentUser.canManage}
							canEditPlayerStats={view.canEditPlayerStats}
							uploadDisabledReason={view.uploadDisabledReason}
						/>
						<ScrimOcrJobsPanel
							scrimId={scrim.id}
							jobs={scrim.ocrJobs}
							canReportResult={view.canReportResult}
							uploadDisabledReason={view.uploadDisabledReason}
							resultRevisions={scrim.resultRevisions}
							maps={scrim.maps}
							reviewAction={
								view.canReportResult ? (
									<ReportScrimResultDialog scrim={scrim} reportingTeamId={team.id}>
										<Button size="sm">Review result</Button>
									</ReportScrimResultDialog>
								) : null
							}
						/>
					</div>
				}
				confirmations={
					<div className="space-y-4">
						<ScrimConfirmationSection
							confirmations={scrim.confirmations}
							dispute={scrim.dispute}
							disputeResolution={view.disputeResolution}
							scrimStatus={scrim.status}
							canResolveDispute={view.canResolveDispute}
						/>
						<ScrimResultRevisions
							resultRevisions={scrim.resultRevisions}
							scrimStatus={scrim.status}
							disputeResolution={view.disputeResolution}
						/>
					</div>
				}
				activity={<ScrimActivityFeed scrim={scrim} />}
			/>
		</PageContainer>
	);
}
