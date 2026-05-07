import { Calendar03Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ScrimDetail } from "@scrimflow/shared";

function formatTimestamp(value: string | null, emptyLabel = "Not set") {
	return value
		? new Intl.DateTimeFormat("en-GB", {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(new Date(value))
		: emptyLabel;
}

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
}

export function ScrimResultRevisions({ resultRevisions }: ScrimResultRevisionsProps) {
	return (
		<section className="border p-4">
			<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Result revision history
			</p>
			<div className="mt-4 space-y-3">
				{resultRevisions.length === 0 ? (
					<div className="border p-3">
						<p className="text-sm font-semibold">No reviewed result revisions yet</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Once a manager submits a reviewed result package, every subsequent revision will be
							preserved here with its correction diff.
						</p>
					</div>
				) : (
					resultRevisions.map((revision) => {
						const visibleFieldChanges = revision.changeSummary.fieldChanges.slice(0, 8);
						const hiddenChangeCount =
							revision.changeSummary.fieldChanges.length - visibleFieldChanges.length;
						const supportingScoreboardJobCount = getSupportingScoreboardJobCount(revision);
						const hasOcrEvidence = !!revision.sourceOcrJobId || supportingScoreboardJobCount > 0;

						return (
							<div key={revision.id} className="border p-3">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div>
										<p className="text-sm font-semibold">Revision #{revision.revisionNumber}</p>
										<p className="mt-1 text-xs text-muted-foreground">
											{revision.submittedByDisplayName
												? `Submitted by ${revision.submittedByDisplayName}`
												: "Submitted by an unknown manager"}
											{revision.reportingTeamName
												? ` from [${revision.reportingTeamTag ?? "TEAM"}] ${revision.reportingTeamName}`
												: ""}
											{" · "}
											{formatTimestamp(revision.createdAt)}
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										<span className="inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold">
											{revision.homeMapScore} - {revision.awayMapScore}
										</span>
										<span className="inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold">
											{revision.changeSummary.changeCount} change(s) vs{" "}
											{formatRevisionBasisLabel(revision.changeSummary.basis)}
										</span>
										<span className="inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold">
											{hasOcrEvidence ? "OCR-assisted" : "Manual"}
										</span>
										{supportingScoreboardJobCount > 0 ? (
											<span className="inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold">
												{supportingScoreboardJobCount} scoreboard OCR job(s)
											</span>
										) : null}
									</div>
								</div>

								<div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
									<div className="flex items-center gap-2">
										<HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
										<span>
											Series window {formatTimestamp(revision.startedAt, "Not set")} to{" "}
											{formatTimestamp(revision.endedAt, "Not set")}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-3.5" />
										<span>
											{revision.snapshot.maps.length} map row(s) ·{" "}
											{revision.snapshot.maps.reduce((total, map) => total + map.players.length, 0)}{" "}
											player row(s)
										</span>
									</div>
								</div>

								{revision.sourceOcrJobId || supportingScoreboardJobCount > 0 ? (
									<p className="mt-3 text-xs text-muted-foreground">
										Primary OCR draft: {revision.sourceOcrJobId ?? "none"}
										{supportingScoreboardJobCount > 0
											? ` · Supporting scoreboard jobs: ${supportingScoreboardJobCount}`
											: ""}
									</p>
								) : null}

								{visibleFieldChanges.length > 0 ? (
									<div className="mt-3 space-y-2">
										{visibleFieldChanges.map((fieldChange) => (
											<div key={fieldChange.path} className="border p-2 text-xs">
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
					})
				)}
			</div>
		</section>
	);
}
