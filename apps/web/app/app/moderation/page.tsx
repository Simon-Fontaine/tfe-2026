import type { ModerationQueueResponse, ReportStatus } from "@scrimflow/shared";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { PageSection } from "@/components/workspace/page-section";
import { apiGet } from "@/lib/api-client";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import { apiRoutes, appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

import { QueueFilters } from "./queue-filters";
import { QueueRowActionsDropdown } from "./queue-row-actions";

const STATUS_FILTERS: { label: string; value: ReportStatus | "all" }[] = [
	{ label: "All", value: "all" },
	{ label: "Pending", value: "pending" },
	{ label: "Under Review", value: "under_review" },
	{ label: "Resolved", value: "resolved" },
	{ label: "Dismissed", value: "dismissed" },
];

function getReportBadgeClass(status: ReportStatus): string {
	if (status === "pending") return STATUS_BADGE_CLASSES.reportPending;
	if (status === "under_review") return STATUS_BADGE_CLASSES.reportUnderReview;
	if (status === "resolved") return STATUS_BADGE_CLASSES.reportResolved;
	return STATUS_BADGE_CLASSES.reportDismissed;
}

const STATUS_LABELS: Record<ReportStatus, string> = {
	pending: "Pending",
	under_review: "Under Review",
	resolved: "Resolved",
	dismissed: "Dismissed",
};

const URGENCY_LABELS = {
	normal: "Normal",
	urgent: "Urgent",
	overdue: "Overdue",
};

interface ModerationQueuePageProps {
	searchParams: Promise<{
		status?: string;
		category?: string;
		targetType?: string;
		assignedTo?: string;
		cursor?: string;
	}>;
}

// P8: builds a queue URL preserving all active filters
function buildQueueHref(params: {
	status?: string;
	category?: string;
	targetType?: string;
	assignedTo?: string;
	cursor?: string | null;
}): string {
	const parts: string[] = [];
	if (params.status && params.status !== "all") parts.push(`status=${params.status}`);
	if (params.category) parts.push(`category=${params.category}`);
	if (params.targetType) parts.push(`targetType=${params.targetType}`);
	if (params.assignedTo) parts.push(`assignedTo=${params.assignedTo}`);
	if (params.cursor) parts.push(`cursor=${encodeURIComponent(params.cursor)}`);
	return parts.length > 0
		? `${appRoutes.moderation.root}?${parts.join("&")}`
		: appRoutes.moderation.root;
}

export default async function ModerationQueuePage({ searchParams }: ModerationQueuePageProps) {
	const { user } = await requireWorkspaceSession();

	if (!user.isModerator) {
		return (
			<AccessGate
				title="Moderation Queue"
				resourceType="moderation"
				reason="role"
				description="This area is restricted to platform moderators."
			/>
		);
	}

	const params = await searchParams;
	const activeStatus = (params.status as ReportStatus | "all") ?? "all";
	const activeCategory = params.category ?? "";
	const activeTargetType = params.targetType ?? "";
	const activeAssignedTo = params.assignedTo ?? "";

	const queryParts: string[] = [];
	if (params.status && params.status !== "all") queryParts.push(`status=${params.status}`);
	if (params.category) queryParts.push(`category=${params.category}`);
	if (params.targetType) queryParts.push(`targetType=${params.targetType}`);
	if (params.assignedTo) queryParts.push(`assignedTo=${params.assignedTo}`);
	if (params.cursor) queryParts.push(`cursor=${encodeURIComponent(params.cursor)}`);
	const query = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";

	const res = await apiGet<ModerationQueueResponse>(`${apiRoutes.moderation.queue}${query}`);

	// P9: distinguish API errors from a genuinely empty queue
	const apiError = !("data" in res) ? "Failed to load moderation queue. Please try again." : null;
	const queueData = "data" in res ? res.data : null;

	const hasActiveFilters =
		activeStatus !== "all" || !!activeCategory || !!activeTargetType || !!activeAssignedTo;

	return (
		<PageContainer>
			<PageHeader
				title="Moderation Queue"
				meta={
					queueData
						? `${queueData.items.length} pending item${queueData.items.length === 1 ? "" : "s"}`
						: "–"
				}
			/>

			<PageSection>
				{/* Status pills — Links preserve all other active filters */}
				<div className="flex flex-wrap gap-2">
					{STATUS_FILTERS.map((filter) => {
						const href = buildQueueHref({
							status: filter.value,
							category: activeCategory,
							targetType: activeTargetType,
							assignedTo: activeAssignedTo,
						});
						const isActive = activeStatus === filter.value;
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

				{/* D4: additional filter controls (client component for interactivity) */}
				<div className="mt-3">
					<QueueFilters
						activeStatus={activeStatus}
						activeCategory={activeCategory}
						activeTargetType={activeTargetType}
						activeAssignedTo={activeAssignedTo}
					/>
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
									<th className="pb-3 pr-4">Urgency</th>
									<th className="pb-3 pr-4">Category</th>
									<th className="pb-3 pr-4">Target</th>
									<th className="pb-3 pr-4">Status</th>
									<th className="pb-3 pr-4">Assigned To</th>
									<th className="pb-3 pr-4">Age</th>
									<th className="pb-3" />
								</tr>
							</thead>
							<tbody className="divide-y">
								{!queueData || queueData.items.length === 0 ? (
									<tr>
										<td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
											{hasActiveFilters
												? "No cases match the current filters."
												: "No pending items."}
										</td>
									</tr>
								) : (
									queueData.items.map((item) => {
										const createdAt = new Date(item.createdAt);
										const ageMs = Date.now() - createdAt.getTime();
										const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
										const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
										const ageLabel = ageDays > 0 ? `${ageDays}d ago` : `${ageHours}h ago`;

										return (
											<tr key={item.id} className="group">
												<td className="py-3 pr-4">
													<div className="flex items-center gap-1.5">
														<span
															className={
																item.urgencyLevel === "overdue"
																	? "inline-block size-2 bg-destructive"
																	: item.urgencyLevel === "urgent"
																		? "inline-block size-2 bg-orange-400"
																		: "inline-block size-2 bg-muted-foreground/30"
															}
															aria-hidden="true"
														/>
														<span className="text-xs">{URGENCY_LABELS[item.urgencyLevel]}</span>
													</div>
												</td>
												<td className="py-3 pr-4 capitalize">{item.category.replace(/_/g, " ")}</td>
												<td className="py-3 pr-4 capitalize">
													{item.targetType.replace(/_/g, " ")}
												</td>
												<td className="py-3 pr-4">
													<Badge variant="outline" className={getReportBadgeClass(item.status)}>
														{STATUS_LABELS[item.status]}
													</Badge>
												</td>
												<td className="py-3 pr-4 text-muted-foreground">
													{item.assignedModeratorName ?? "Unassigned"}
												</td>
												<td className="py-3 pr-4 text-muted-foreground">{ageLabel}</td>
												<td className="py-3 text-right">
													<QueueRowActionsDropdown reportId={item.id} userId={user.id} />
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				)}

				{queueData?.nextCursor && (
					<div className="pt-4">
						<Link
							href={buildQueueHref({
								status: activeStatus,
								category: activeCategory,
								targetType: activeTargetType,
								assignedTo: activeAssignedTo,
								cursor: queueData.nextCursor,
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
