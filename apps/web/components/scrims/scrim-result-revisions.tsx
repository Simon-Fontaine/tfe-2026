import { Calendar03Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ScrimDetail, ScrimDisputeResolution } from "@scrimflow/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import { formatScrimTimestamp } from "@/lib/scrims/format";
import { cn } from "@/lib/utils";

function formatRevisionBasisLabel(
	basis: ScrimDetail["resultRevisions"][number]["changeSummary"]["basis"]
) {
	if (basis === "ocr_job") return "OCR draft";
	if (basis === "previous_revision") return "previous revision";
	if (basis === "existing_result") return "existing result";
	return "empty baseline";
}

function formatRevisionValue(
	value: ScrimDetail["resultRevisions"][number]["changeSummary"]["fieldChanges"][number]["before"]
) {
	if (value === null) return "empty";
	if (typeof value === "string") return value || '""';
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	const serialized = JSON.stringify(value);
	return serialized.length > 80 ? `${serialized.slice(0, 77)}...` : serialized;
}

function getSupportingScoreboardJobCount(revision: ScrimDetail["resultRevisions"][number]) {
	return new Set(
		revision.snapshot.maps.flatMap((map) =>
			map.scoreboardOcrJobId ? [map.scoreboardOcrJobId] : []
		)
	).size;
}

interface ScrimResultRevisionsProps {
	resultRevisions: ScrimDetail["resultRevisions"];
	scrimStatus: ScrimDetail["status"];
	disputeResolution?: ScrimDisputeResolution | null;
}

export function ScrimResultRevisions({
	resultRevisions,
	scrimStatus,
	disputeResolution,
}: ScrimResultRevisionsProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Result revision history</CardTitle>
			</CardHeader>
			<CardContent>
				{resultRevisions.length === 0 ? (
					<div className="bg-muted/30 p-3">
						<p className="text-sm font-semibold">No reviewed result revisions yet</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Once a manager submits a reviewed result package, every subsequent revision is
							preserved here with its correction diff.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{resultRevisions.map((revision, index) => {
							const visibleFieldChanges = revision.changeSummary.fieldChanges.slice(0, 8);
							const hiddenChangeCount =
								revision.changeSummary.fieldChanges.length - visibleFieldChanges.length;
							const supportingScoreboardJobCount = getSupportingScoreboardJobCount(revision);
							const hasOcrEvidence = !!revision.sourceOcrJobId || supportingScoreboardJobCount > 0;
							const isLatest = index === 0;

							return (
								<div
									key={revision.id}
									className={cn(
										"p-3",
										isLatest ? "bg-primary/5 ring-1 ring-primary/20" : "bg-muted/30"
									)}
								>
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div className="min-w-0">
											<p className="text-sm font-semibold">Revision #{revision.revisionNumber}</p>
											<p className="mt-1 text-xs text-muted-foreground">
												{revision.submittedByDisplayName
													? `Submitted by ${revision.submittedByDisplayName}`
													: "Submitted by an unknown manager"}
												{revision.reportingTeamName
													? ` from [${revision.reportingTeamTag ?? "TEAM"}] ${revision.reportingTeamName}`
													: ""}
												{" · "}
												{formatScrimTimestamp(revision.createdAt)}
											</p>
										</div>
										<div className="flex flex-wrap gap-1.5">
											<Badge variant="outline">
												{revision.homeMapScore} - {revision.awayMapScore}
											</Badge>
											<Badge variant="outline">
												{revision.changeSummary.changeCount} change(s) vs{" "}
												{formatRevisionBasisLabel(revision.changeSummary.basis)}
											</Badge>
											<Badge variant="outline">{hasOcrEvidence ? "OCR-assisted" : "Manual"}</Badge>
											{supportingScoreboardJobCount > 0 ? (
												<Badge variant="outline">
													{supportingScoreboardJobCount} scoreboard OCR job(s)
												</Badge>
											) : null}
											{isLatest && scrimStatus === "completed" ? (
												<Badge variant="outline" className={STATUS_BADGE_CLASSES.completed}>
													Settled result
												</Badge>
											) : null}
											{isLatest && disputeResolution === "voided" ? (
												<Badge variant="outline" className={STATUS_BADGE_CLASSES.voided}>
													Result voided — not applied
												</Badge>
											) : null}
										</div>
									</div>

									<div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
										<div className="flex items-center gap-2">
											<HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
											<span>
												Series window {formatScrimTimestamp(revision.startedAt, "Not set")} to{" "}
												{formatScrimTimestamp(revision.endedAt, "Not set")}
											</span>
										</div>
										<div className="flex items-center gap-2">
											<HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-3.5" />
											<span>
												{revision.snapshot.maps.length} map row(s) ·{" "}
												{revision.snapshot.maps.reduce(
													(total, map) => total + map.players.length,
													0
												)}{" "}
												player row(s)
											</span>
										</div>
									</div>

									{visibleFieldChanges.length > 0 ? (
										<div className="mt-3 space-y-1.5">
											{visibleFieldChanges.map((fieldChange) => (
												<div key={fieldChange.path} className="bg-background/60 p-2 text-xs">
													<p className="font-medium">{fieldChange.path}</p>
													<p className="mt-1 text-muted-foreground">
														{formatRevisionValue(fieldChange.before)} →{" "}
														{formatRevisionValue(fieldChange.after)}
													</p>
												</div>
											))}
											{hiddenChangeCount > 0 ? (
												<p className="text-xs text-muted-foreground">
													+ {hiddenChangeCount} more change(s) in this revision
												</p>
											) : null}
										</div>
									) : (
										<p className="mt-3 text-xs text-muted-foreground">
											This revision matches its comparison baseline exactly.
										</p>
									)}
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
