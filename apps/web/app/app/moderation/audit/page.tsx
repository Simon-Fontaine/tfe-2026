import type {
	DomainAuditActorType,
	DomainAuditDomain,
	DomainAuditEventsResponse,
} from "@scrimflow/shared";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { PageSection } from "@/components/workspace/page-section";
import { apiGet } from "@/lib/api-client";
import { apiRoutes, appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

const DOMAIN_FILTERS: { label: string; value: DomainAuditDomain | "all" }[] = [
	{ label: "All", value: "all" },
	{ label: "Ownership", value: "ownership" },
	{ label: "Moderation", value: "moderation" },
	{ label: "Result", value: "result" },
	{ label: "Evidence", value: "evidence" },
	{ label: "Data Lifecycle", value: "data_lifecycle" },
	{ label: "Permissions", value: "permissions" },
	{ label: "Admin", value: "admin" },
];

const ACTION_TYPE_LABELS: Record<string, string> = {
	ownership_transfer_initiated: "Ownership Transfer Initiated",
	ownership_transfer_accepted: "Ownership Transfer Accepted",
	ownership_transfer_declined: "Ownership Transfer Declined",
	ownership_recovery_initiated: "Ownership Recovery Initiated",
	ownership_recovery_resolved: "Ownership Recovery Resolved",
	permission_role_changed: "Permission Role Changed",
	permission_member_removed: "Member Removed",
	moderation_action_taken: "Moderation Action",
	moderation_action_reversed: "Moderation Action Reversed",
	result_correction_applied: "Result Correction Applied",
	dispute_initiated: "Dispute Initiated",
	dispute_responded: "Dispute Responded",
	dispute_resolved: "Dispute Resolved",
	dispute_voided: "Scrim Voided",
	evidence_uploaded: "Evidence Uploaded",
	evidence_removed: "Evidence Removed",
	account_deletion_requested: "Account Deletion Requested",
	account_deletion_confirmed: "Account Deletion Confirmed",
	account_deletion_cancelled: "Account Deletion Cancelled",
	data_export_requested: "Data Export Requested",
	lifecycle_archived: "Archived",
	lifecycle_restored: "Restored",
	lifecycle_deletion_pending: "Deletion Pending",
};

const OUTCOME_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
	success: "default",
	failure: "destructive",
	blocked: "secondary",
	partial: "outline",
};

function actorTypeBadge(actorType: DomainAuditActorType) {
	if (actorType === "system") return <Badge variant="secondary">System</Badge>;
	if (actorType === "worker") return <Badge variant="outline">Worker</Badge>;
	return <Badge variant="outline">User</Badge>;
}

type AuditQueryParams = {
	domain?: string;
	actionType?: string;
	targetType?: string;
	actorId?: string;
	outcome?: string;
	from?: string;
	to?: string;
	cursor?: string | null;
};

function buildAuditQuery(params: AuditQueryParams): string {
	const parts: string[] = [];
	if (params.domain && params.domain !== "all")
		parts.push(`domain=${encodeURIComponent(params.domain)}`);
	if (params.actionType) parts.push(`actionType=${encodeURIComponent(params.actionType)}`);
	if (params.targetType) parts.push(`targetType=${encodeURIComponent(params.targetType)}`);
	if (params.actorId) parts.push(`actorId=${encodeURIComponent(params.actorId)}`);
	if (params.outcome) parts.push(`outcome=${encodeURIComponent(params.outcome)}`);
	if (params.from) parts.push(`from=${encodeURIComponent(params.from)}`);
	if (params.to) parts.push(`to=${encodeURIComponent(params.to)}`);
	if (params.cursor) parts.push(`cursor=${encodeURIComponent(params.cursor)}`);
	return parts.length > 0 ? `?${parts.join("&")}` : "";
}

function buildAuditHref(params: AuditQueryParams): string {
	return `${appRoutes.moderation.audit}${buildAuditQuery(params)}`;
}

interface AuditLogPageProps {
	searchParams: Promise<{
		domain?: string;
		actionType?: string;
		targetType?: string;
		actorId?: string;
		outcome?: string;
		from?: string;
		to?: string;
		cursor?: string;
	}>;
}

export default async function AuditLogPage({ searchParams }: AuditLogPageProps) {
	const { user } = await requireWorkspaceSession();

	if (!user.isModerator) {
		return (
			<AccessGate
				title="Audit Log"
				resourceType="moderation"
				reason="role"
				description="This area is restricted to platform moderators."
			/>
		);
	}

	const params = await searchParams;
	const activeDomain = (params.domain as DomainAuditDomain | "all") ?? "all";

	const query = buildAuditQuery(params);
	const res = await apiGet<DomainAuditEventsResponse>(`${apiRoutes.moderation.audit}${query}`);

	const apiError = !("data" in res) ? "Failed to load audit events. Please try again." : null;
	const auditData = "data" in res ? res.data : null;

	const hasActiveFilters =
		activeDomain !== "all" ||
		!!params.actionType ||
		!!params.targetType ||
		!!params.actorId ||
		!!params.outcome;

	return (
		<PageContainer>
			<PageHeader
				title="Audit Log"
				breadcrumbs={
					<Link href={appRoutes.moderation.root} className="hover:underline">
						Moderation
					</Link>
				}
			/>

			<PageSection>
				<div className="flex flex-wrap gap-2">
					{DOMAIN_FILTERS.map((filter) => {
						const href = buildAuditHref({
							domain: filter.value,
							actionType: params.actionType,
							targetType: params.targetType,
							actorId: params.actorId,
							outcome: params.outcome,
						});
						const isActive = activeDomain === filter.value;
						return (
							<Link
								key={filter.value}
								href={href}
								className={
									isActive
										? "inline-flex items-center px-3 py-1 text-sm font-medium ring-1 ring-inset bg-primary text-primary-foreground ring-primary"
										: "inline-flex items-center px-3 py-1 text-sm font-medium ring-1 ring-inset text-foreground ring-border hover:bg-muted"
								}
							>
								{filter.label}
							</Link>
						);
					})}
				</div>
			</PageSection>

			<PageSection>
				{apiError ? (
					<div className="border-l-4 border-destructive bg-destructive/10 p-4 text-sm">
						{apiError}
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
									<th className="pb-3 pr-4">Actor</th>
									<th className="pb-3 pr-4">Domain</th>
									<th className="pb-3 pr-4">Action</th>
									<th className="pb-3 pr-4">Target</th>
									<th className="pb-3 pr-4">Outcome</th>
									<th className="pb-3 pr-4">Time</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{!auditData || auditData.events.length === 0 ? (
									<tr>
										<td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
											{hasActiveFilters
												? "No audit events match the current filters."
												: "No audit events recorded yet."}
										</td>
									</tr>
								) : (
									auditData.events.map((event) => {
										const createdAt = new Date(event.createdAt);
										const timeLabel = createdAt.toLocaleString();
										const actionLabel =
											ACTION_TYPE_LABELS[event.actionType] ?? event.actionType.replace(/_/g, " ");
										const metadataEntries = event.metadata
											? Object.entries(event.metadata).slice(0, 3)
											: [];

										return (
											<tr key={event.id} className="group align-top">
												<td className="py-3 pr-4">
													<div className="flex items-center gap-1.5">
														{actorTypeBadge(event.actorType)}
														{event.actorId ? (
															<span className="font-mono text-xs text-muted-foreground">
																{event.actorId.slice(0, 8)}…
															</span>
														) : (
															<span className="text-xs text-muted-foreground">—</span>
														)}
													</div>
												</td>
												<td className="py-3 pr-4 capitalize text-muted-foreground">
													{event.domain.replace(/_/g, " ")}
												</td>
												<td className="py-3 pr-4">
													<div>
														<span>{actionLabel}</span>
														{event.reason && (
															<p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
																{event.reason}
															</p>
														)}
														{metadataEntries.length > 0 && (
															<p className="mt-0.5 text-xs text-muted-foreground">
																{metadataEntries
																	.map(([k, v]) => `${k}: ${String(v).slice(0, 20)}`)
																	.join(" · ")}
															</p>
														)}
													</div>
												</td>
												<td className="py-3 pr-4">
													{event.targetType && event.targetId ? (
														<span className="text-xs">
															<span className="capitalize">{event.targetType}</span>{" "}
															<span className="font-mono text-muted-foreground">
																{event.targetId.slice(0, 8)}…
															</span>
														</span>
													) : (
														<span className="text-xs text-muted-foreground">—</span>
													)}
												</td>
												<td className="py-3 pr-4">
													{event.outcome ? (
														<Badge variant={OUTCOME_VARIANT[event.outcome] ?? "outline"}>
															{event.outcome}
														</Badge>
													) : (
														<span className="text-xs text-muted-foreground">—</span>
													)}
												</td>
												<td className="py-3 text-xs text-muted-foreground">{timeLabel}</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				)}

				{auditData?.hasMore && auditData.nextCursor && (
					<div className="pt-4">
						<Link
							href={buildAuditHref({
								domain: activeDomain,
								actionType: params.actionType,
								targetType: params.targetType,
								actorId: params.actorId,
								outcome: params.outcome,
								cursor: auditData.nextCursor,
							})}
							className="text-sm text-primary underline-offset-2 hover:underline"
						>
							Load more
						</Link>
					</div>
				)}
			</PageSection>
		</PageContainer>
	);
}
