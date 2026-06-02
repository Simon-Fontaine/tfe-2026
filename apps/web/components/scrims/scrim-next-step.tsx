import type { ScrimDetail, TeamMemberSummary } from "@scrimflow/shared";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ScrimViewModel } from "@/lib/scrims/view-model";
import { ConfirmScrimDialog } from "./confirm-scrim-dialog";
import { ReportScrimResultDialog } from "./report-scrim-result-dialog";
import { ResolveScrimDisputeDialog } from "./resolve-scrim-dispute-dialog";
import { ScrimDisputeResponseDialog } from "./scrim-dispute-response-dialog";
import { ScrimRespondActions } from "./scrim-respond-actions";

interface ScrimNextStepProps {
	scrim: ScrimDetail;
	view: ScrimViewModel;
	teamId: string;
	rosterPlayers: TeamMemberSummary[];
	canManage: boolean;
	primaryChatHref: string | null;
}

export function ScrimNextStep({
	scrim,
	view,
	teamId,
	rosterPlayers,
	canManage,
	primaryChatHref,
}: ScrimNextStepProps) {
	const primaryButton =
		view.primaryAction === "report_result" ? (
			<ReportScrimResultDialog scrim={scrim} reportingTeamId={teamId} rosterPlayers={rosterPlayers}>
				<Button size="sm">Open Result Workbench</Button>
			</ReportScrimResultDialog>
		) : view.primaryAction === "review_confirmation" ? (
			<ConfirmScrimDialog
				scrimId={scrim.id}
				teamId={teamId}
				currentStatus={view.currentConfirmation?.status ?? "pending"}
			>
				<Button size="sm">Review confirmation</Button>
			</ConfirmScrimDialog>
		) : view.primaryAction === "respond_dispute" ? (
			<ScrimDisputeResponseDialog scrimId={scrim.id} reportingTeamId={teamId}>
				<Button size="sm">Respond to dispute</Button>
			</ScrimDisputeResponseDialog>
		) : view.primaryAction === "resolve_dispute" ? (
			<ResolveScrimDisputeDialog scrimId={scrim.id}>
				<Button size="sm">Resolve dispute</Button>
			</ResolveScrimDisputeDialog>
		) : null;

	return (
		<Card>
			<CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div className="min-w-0 flex-1 space-y-1">
					<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
						Next step
					</p>
					<p className="text-base font-semibold">{view.nextStepLabel}</p>
					<p className="text-xs text-muted-foreground">{view.stageDescription}</p>
				</div>
				<div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
					{primaryButton}
					{primaryChatHref ? (
						<Button asChild size="sm" variant="outline">
							<Link href={primaryChatHref}>Open scrim chat</Link>
						</Button>
					) : null}
					<ScrimRespondActions
						scrimId={scrim.id}
						teamId={teamId}
						scrimStatus={scrim.status}
						awayTeamId={scrim.awayTeam?.id ?? null}
						scheduledAt={scrim.scheduledAt}
						canManage={canManage}
					/>
				</div>
			</CardContent>
		</Card>
	);
}
