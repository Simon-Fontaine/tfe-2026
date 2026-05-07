import { Calendar03Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ScrimDetail } from "@scrimflow/shared";
import { Badge } from "@/components/ui/badge";

function formatTimestamp(value: string | null, emptyLabel = "Not set") {
	return value
		? new Intl.DateTimeFormat("en-GB", {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(new Date(value))
		: emptyLabel;
}

function getConfirmationVariant(status: "pending" | "confirmed" | "disputed") {
	if (status === "disputed") return "destructive" as const;
	if (status === "confirmed") return "secondary" as const;
	return "outline" as const;
}

function getDisputeResolutionVariant(resolution: string | null) {
	if (resolution === "voided") return "destructive" as const;
	if (resolution === "admin_resolved") return "secondary" as const;
	return "outline" as const;
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
	scrimId: string;
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
	return (
		<>
			<section className="border p-4">
				<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					Confirmation state
				</p>
				<div className="mt-4 space-y-3">
					{confirmations.map((confirmation) => (
						<div key={confirmation.id} className="border p-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<p className="text-sm font-semibold">
										[{confirmation.teamTag}] {confirmation.teamName}
									</p>
									<p className="text-xs text-muted-foreground">
										{confirmation.confirmedByDisplayName
											? `Last handled by ${confirmation.confirmedByDisplayName}`
											: "No manager confirmation submitted yet."}
									</p>
								</div>
								<Badge variant={getConfirmationVariant(confirmation.status)}>
									{confirmation.status}
								</Badge>
							</div>

							<div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
								<div className="flex items-center gap-2">
									<HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
									<span>{formatTimestamp(confirmation.confirmedAt, "No confirmation time")}</span>
								</div>
								<div className="flex items-center gap-2">
									<HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-3.5" />
									<span>Last updated {formatTimestamp(confirmation.updatedAt)}</span>
								</div>
							</div>

							{confirmation.disputeReason ? (
								<p className="mt-3 text-xs text-destructive">
									Dispute reason: {confirmation.disputeReason}
								</p>
							) : null}
						</div>
					))}
				</div>
			</section>

			{scrimStatus === "disputed" || dispute.resolution ? (
				<section className="border p-4">
					<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Dispute resolution
					</p>
					<div className="mt-4 space-y-3">
						<div className="border p-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<p className="text-sm font-semibold">
										{getDisputeResolutionLabel(disputeResolution)}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{dispute.resolvedByDisplayName
											? `Resolved by ${dispute.resolvedByDisplayName}`
											: "This scrim still needs org-level dispute review."}
									</p>
								</div>
								<Badge variant={getDisputeResolutionVariant(disputeResolution)}>
									{getDisputeResolutionLabel(disputeResolution)}
								</Badge>
							</div>

							<div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
								<div className="flex items-center gap-2">
									<HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
									<span>{formatTimestamp(dispute.resolvedAt, "No resolution timestamp")}</span>
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
								<p className="mt-3 text-xs text-muted-foreground">
									Resolution notes: {dispute.notes}
								</p>
							) : null}
						</div>
					</div>
				</section>
			) : null}
		</>
	);
}
