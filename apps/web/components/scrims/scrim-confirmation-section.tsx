import { Calendar03Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ScrimDetail } from "@scrimflow/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import { formatScrimTimestamp } from "@/lib/scrims/format";

function getConfirmationBadgeClass(status: "pending" | "confirmed" | "disputed") {
	if (status === "disputed") return STATUS_BADGE_CLASSES.disputed;
	if (status === "confirmed") return STATUS_BADGE_CLASSES.completed;
	return STATUS_BADGE_CLASSES.pending;
}

function getDisputeResolutionBadgeClass(resolution: string | null) {
	if (resolution === "voided") return STATUS_BADGE_CLASSES.voided;
	if (resolution === "admin_resolved") return STATUS_BADGE_CLASSES.resolved;
	return STATUS_BADGE_CLASSES.pending;
}

function getDisputeResolutionLabel(resolution: string | null) {
	if (resolution === "pending") return "Awaiting resolution";
	if (resolution === "admin_resolved") return "Result finalized";
	if (resolution === "voided") return "Scrim voided";
	if (resolution === "home_confirmed") return "Home team confirmed";
	if (resolution === "away_confirmed") return "Away team confirmed";
	return "Not required";
}

interface ScrimConfirmationSectionProps {
	confirmations: ScrimDetail["confirmations"];
	dispute: ScrimDetail["dispute"];
	disputeResolution: string | null;
	scrimStatus: ScrimDetail["status"];
	canResolveDispute: boolean;
}

export function ScrimConfirmationSection({
	confirmations,
	dispute,
	disputeResolution,
	scrimStatus,
	canResolveDispute,
}: ScrimConfirmationSectionProps) {
	const showDispute = scrimStatus === "disputed" || !!dispute.resolution;

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Confirmation state</CardTitle>
					<CardDescription>
						Both teams confirm the same result before ratings change.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="divide-y divide-border">
						{confirmations.map((confirmation) => (
							<div key={confirmation.id} className="py-3 first:pt-0 last:pb-0">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="min-w-0">
										<p className="text-sm font-semibold">
											[{confirmation.teamTag}] {confirmation.teamName}
										</p>
										<p className="text-xs text-muted-foreground">
											{confirmation.confirmedByDisplayName
												? `Last handled by ${confirmation.confirmedByDisplayName}`
												: "No manager confirmation submitted yet."}
										</p>
									</div>
									<Badge
										variant="outline"
										className={getConfirmationBadgeClass(confirmation.status)}
									>
										{confirmation.status}
									</Badge>
								</div>

								<div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
									<div className="flex items-center gap-2">
										<HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
										<span>
											{formatScrimTimestamp(confirmation.confirmedAt, "No confirmation time")}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-3.5" />
										<span>Last updated {formatScrimTimestamp(confirmation.updatedAt)}</span>
									</div>
								</div>

								{confirmation.disputeReason ? (
									<p className="mt-2 bg-destructive/5 p-2 text-xs text-destructive">
										Dispute reason: {confirmation.disputeReason}
									</p>
								) : null}
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{showDispute ? (
				<Card>
					<CardHeader>
						<CardTitle>Dispute resolution</CardTitle>
						<CardDescription>
							{dispute.resolvedByDisplayName
								? `Resolved by ${dispute.resolvedByDisplayName}`
								: "This scrim still needs org-level dispute review."}
						</CardDescription>
						<Badge variant="outline" className={getDisputeResolutionBadgeClass(disputeResolution)}>
							{getDisputeResolutionLabel(disputeResolution)}
						</Badge>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
							<div className="flex items-center gap-2">
								<HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
								<span>{formatScrimTimestamp(dispute.resolvedAt, "No resolution timestamp")}</span>
							</div>
							<div className="flex items-center gap-2">
								<HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-3.5" />
								<span>
									{dispute.resolvedAt
										? "This dispute has already been settled."
										: canResolveDispute
											? "You can resolve this dispute from the current org context."
											: "Only org-level managers can resolve disputed scrims."}
								</span>
							</div>
						</div>

						{dispute.notes ? (
							<p className="bg-muted/40 p-2 text-xs text-muted-foreground">
								Resolution notes: {dispute.notes}
							</p>
						) : null}

						{showDispute ? (
							<div className="bg-muted/30 p-3">
								<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Reporting team response
								</p>
								{dispute.disputeResponse ? (
									<div className="mt-2 space-y-1">
										<p className="text-xs">{dispute.disputeResponse}</p>
										<p className="text-[11px] text-muted-foreground">
											{dispute.disputeRespondedByDisplayName
												? `Submitted by ${dispute.disputeRespondedByDisplayName}`
												: "Submitted"}
											{dispute.disputeRespondedAt
												? ` · ${formatScrimTimestamp(dispute.disputeRespondedAt)}`
												: ""}
										</p>
									</div>
								) : (
									<p className="mt-2 text-xs text-muted-foreground">
										No response yet — the reporting team has not replied to this dispute.
									</p>
								)}
							</div>
						) : null}
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
