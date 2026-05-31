import type { ModerationCaseDetail, ReportStatus } from "@scrimflow/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { CaseActions } from "@/components/moderation/case-actions";
import { EnforcementActions } from "@/components/moderation/enforcement-actions";
import { Badge } from "@/components/ui/badge";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { PageSection } from "@/components/workspace/page-section";
import { apiGet } from "@/lib/api-client";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import { apiRoutes, appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

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

const EVENT_ACTION_LABELS: Record<string, string> = {
	viewed: "Reviewed by",
	assigned: "Assigned to",
	unassigned: "Unassigned by",
	noted: "Note by",
	resolved: "Resolved by",
	dismissed: "Dismissed by",
};

interface ModerationCasePageProps {
	params: Promise<{ reportId: string }>;
}

export default async function ModerationCasePage({ params }: ModerationCasePageProps) {
	const { user } = await requireWorkspaceSession();

	if (!user.isModerator) {
		return (
			<AccessGate
				title="Case File"
				resourceType="moderation"
				reason="role"
				description="This area is restricted to platform moderators."
			/>
		);
	}

	const { reportId } = await params;

	const res = await apiGet<ModerationCaseDetail>(apiRoutes.moderation.report(reportId));
	if (!("data" in res)) notFound();

	const caseDetail = res.data;

	return (
		<PageContainer>
			<PageHeader
				breadcrumbs={
					<>
						<Link href={appRoutes.moderation.root} className="hover:underline">
							Moderation
						</Link>
						{" / Reports / "}
						{reportId}
					</>
				}
				title={caseDetail.category.replace(/_/g, " ")}
			/>

			<div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
				<div className="sm:col-span-2 space-y-6">
					<PageSection title="Report Details">
						<dl className="divide-y text-sm">
							<div className="flex gap-4 py-2">
								<dt className="w-36 shrink-0 font-medium text-muted-foreground">Category</dt>
								<dd className="capitalize">{caseDetail.category.replace(/_/g, " ")}</dd>
							</div>
							<div className="flex gap-4 py-2">
								<dt className="w-36 shrink-0 font-medium text-muted-foreground">Target type</dt>
								<dd className="capitalize">{caseDetail.targetType.replace(/_/g, " ")}</dd>
							</div>
							<div className="flex gap-4 py-2">
								<dt className="w-36 shrink-0 font-medium text-muted-foreground">Reason</dt>
								<dd>{caseDetail.reason}</dd>
							</div>
							{caseDetail.assignedModeratorName && (
								<div className="flex gap-4 py-2">
									<dt className="w-36 shrink-0 font-medium text-muted-foreground">Assigned to</dt>
									<dd>{caseDetail.assignedModeratorName}</dd>
								</div>
							)}
							{caseDetail.resolvedAt && (
								<div className="flex gap-4 py-2">
									<dt className="w-36 shrink-0 font-medium text-muted-foreground">Settled at</dt>
									<dd>{new Date(caseDetail.resolvedAt).toLocaleString()}</dd>
								</div>
							)}
						</dl>
					</PageSection>

					{caseDetail.targetSnapshot && Object.keys(caseDetail.targetSnapshot).length > 0 && (
						<PageSection title="Target Context">
							<dl className="divide-y text-sm">
								{Object.entries(caseDetail.targetSnapshot).map(([key, value]) => (
									<div key={key} className="flex gap-4 py-2">
										<dt className="w-36 shrink-0 font-medium capitalize text-muted-foreground">
											{key.replace(/([A-Z])/g, " $1").toLowerCase()}
										</dt>
										<dd>{String(value)}</dd>
									</div>
								))}
							</dl>
						</PageSection>
					)}

					{caseDetail.supplements.length > 0 && (
						<PageSection title="Supplements">
							<ol className="space-y-3">
								{caseDetail.supplements.map((s, i) => (
									<li key={s.id} className="border p-3 text-sm">
										<div className="mb-1 text-xs text-muted-foreground">
											#{i + 1} · {new Date(s.createdAt).toLocaleString()}
										</div>
										<p>{s.content}</p>
									</li>
								))}
							</ol>
						</PageSection>
					)}

					<PageSection title="Event Timeline">
						{caseDetail.events.length === 0 ? (
							<p className="text-sm text-muted-foreground">No events yet.</p>
						) : (
							<ol className="space-y-2">
								{caseDetail.events.map((event) => {
									const isViewed = event.action === "viewed";
									const label = EVENT_ACTION_LABELS[event.action] ?? event.action;
									const metadata = event.metadata as Record<string, string> | null;

									return (
										<li
											key={event.id}
											className={isViewed ? "text-xs text-muted-foreground" : "border p-3 text-sm"}
										>
											<div className={isViewed ? "" : "mb-1 text-xs text-muted-foreground"}>
												{label} {event.moderatorName} · {new Date(event.createdAt).toLocaleString()}
											</div>
											{event.action === "noted" && metadata?.content && (
												<p className="mt-1">{metadata.content}</p>
											)}
											{(event.action === "resolved" || event.action === "dismissed") &&
												metadata?.reason && <p className="mt-1">{metadata.reason}</p>}
										</li>
									);
								})}
							</ol>
						)}
					</PageSection>
				</div>

				<div className="sm:col-span-1 sm:sticky sm:top-6 self-start space-y-4">
					<section className="border p-4 space-y-3">
						<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Status
						</p>
						<Badge variant="outline" className={getReportBadgeClass(caseDetail.status)}>
							{STATUS_LABELS[caseDetail.status]}
						</Badge>
						<p className="text-xs text-muted-foreground">
							Urgency: {URGENCY_LABELS[caseDetail.urgencyLevel]}
						</p>
					</section>
					<CaseActions
						reportId={caseDetail.id}
						currentStatus={caseDetail.status}
						assignedModeratorId={caseDetail.assignedModeratorId}
						currentUserId={user.id}
					/>
					<EnforcementActions
						reportId={caseDetail.id}
						targetType={caseDetail.targetType}
						targetId={caseDetail.targetId}
						activeActions={caseDetail.activeActions}
					/>
				</div>
			</div>
		</PageContainer>
	);
}
