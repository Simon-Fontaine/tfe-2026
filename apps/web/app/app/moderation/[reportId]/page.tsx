import type { ModerationCaseDetail, ReportStatus } from "@scrimflow/shared";
import { notFound } from "next/navigation";

import { CaseActions } from "@/components/moderation/case-actions";
import { EnforcementActions } from "@/components/moderation/enforcement-actions";
import { Badge } from "@/components/ui/badge";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { apiGet } from "@/lib/api-client";
import { apiRoutes, appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

const STATUS_BADGE_VARIANT: Record<
	ReportStatus,
	"default" | "secondary" | "outline" | "destructive"
> = {
	pending: "secondary",
	under_review: "outline",
	resolved: "default",
	dismissed: "secondary",
};

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
				title={`Case: ${caseDetail.category.replace(/_/g, " ")}`}
				detail={`${caseDetail.targetType.replace(/_/g, " ")} · ${appRoutes.moderation.root}`}
				badge={
					<Badge variant={STATUS_BADGE_VARIANT[caseDetail.status]}>
						{STATUS_LABELS[caseDetail.status]}
					</Badge>
				}
				description={`Urgency: ${URGENCY_LABELS[caseDetail.urgencyLevel]} · Submitted ${new Date(caseDetail.createdAt).toLocaleString()}`}
				actions={
					<a
						href={appRoutes.moderation.root}
						className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
					>
						← Back to queue
					</a>
				}
			/>

			<div className="grid gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
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
									<li key={s.id} className="rounded-md border p-3 text-sm">
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
											className={
												isViewed ? "text-xs text-muted-foreground" : "rounded-md border p-3 text-sm"
											}
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

				<div className="space-y-4">
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
