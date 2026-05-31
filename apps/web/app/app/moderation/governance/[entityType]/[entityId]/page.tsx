import type { GovernanceEntityState } from "@scrimflow/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { PageSection } from "@/components/workspace/page-section";
import { apiGet } from "@/lib/api-client";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import { apiRoutes, appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

import { OwnershipResolutionForm } from "./ownership-resolution-form";

const VALID_ENTITY_TYPES = ["user", "team", "organization"] as const;
type ValidEntityType = (typeof VALID_ENTITY_TYPES)[number];

interface GovernanceEntityPageProps {
	params: Promise<{ entityType: string; entityId: string }>;
}

export default async function GovernanceEntityPage({ params }: GovernanceEntityPageProps) {
	const { user } = await requireWorkspaceSession();

	if (!user.isModerator) {
		return (
			<AccessGate
				title="Governance Entity"
				resourceType="moderation"
				description="You must be a moderator to access governance recovery."
			/>
		);
	}

	const { entityType, entityId } = await params;

	if (!VALID_ENTITY_TYPES.includes(entityType as ValidEntityType)) {
		notFound();
	}

	const res = await apiGet<GovernanceEntityState>(
		apiRoutes.moderation.governance.entity(entityType, entityId)
	);

	if ("error" in res) {
		if (res.status === 404) notFound();
		throw new Error(res.error);
	}
	const state = res.data;

	const openWorkflow =
		state.ownershipWorkflow &&
		(state.ownershipWorkflow.status === "review_required" ||
			state.ownershipWorkflow.status === "blocked")
			? state.ownershipWorkflow
			: null;

	return (
		<PageContainer>
			<PageHeader
				breadcrumbs={
					<>
						<Link href={appRoutes.moderation.root} className="hover:underline">
							Moderation
						</Link>
						{" / "}
						<Link href={appRoutes.moderation.governance.root} className="hover:underline">
							Governance
						</Link>
						{" / "}
						{state.entityType.charAt(0).toUpperCase() + state.entityType.slice(1)}
						{" / "}
						{state.displayName}
					</>
				}
				title={state.displayName}
			/>

			<div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
				<div className="sm:col-span-2 space-y-6">
					<PageSection title="Recent Audit Events">
						{state.recentAuditEvents.length === 0 ? (
							<p className="text-sm text-muted-foreground">No recent audit events.</p>
						) : (
							<div className="divide-y">
								{state.recentAuditEvents.map((event) => (
									<div key={event.id} className="flex items-center justify-between py-2 text-sm">
										<div className="flex items-center gap-2">
											<Badge variant="outline">{event.actionType}</Badge>
											{event.outcome && (
												<span
													className={
														event.outcome === "success" ? "text-green-600" : "text-destructive"
													}
												>
													{event.outcome}
												</span>
											)}
										</div>
										<span className="text-xs text-muted-foreground">
											{new Date(event.createdAt).toLocaleDateString()}
										</span>
									</div>
								))}
							</div>
						)}
					</PageSection>

					<PageSection title="Active Moderation Actions">
						{state.activeActions.length === 0 ? (
							<p className="text-sm text-muted-foreground">No active moderation actions.</p>
						) : (
							<div className="divide-y">
								{state.activeActions.map((action) => (
									<div key={action.id} className="flex items-center justify-between py-2 text-sm">
										<div className="flex items-center gap-2">
											<Badge variant="outline">{action.actionType}</Badge>
											<span className="text-muted-foreground">{action.reason}</span>
										</div>
										<span className="text-xs text-muted-foreground">
											{new Date(action.createdAt).toLocaleDateString()}
										</span>
									</div>
								))}
							</div>
						)}
					</PageSection>
				</div>

				<div className="sm:col-span-1 sm:sticky sm:top-6 self-start space-y-4">
					<section className="border p-4 space-y-3">
						<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Entity
						</p>
						<div className="flex flex-wrap gap-2">
							<Badge variant="outline" className="text-xs">
								{state.entityType}
							</Badge>
							{state.isSuspended && (
								<Badge variant="outline" className={STATUS_BADGE_CLASSES.suspended}>
									Suspended
								</Badge>
							)}
							{state.isArchived && <Badge variant="outline">Archived</Badge>}
							{state.isDeletionPending && (
								<Badge variant="outline" className={STATUS_BADGE_CLASSES.deletionPending}>
									Deletion Pending
								</Badge>
							)}
							{state.isAnonymized && <Badge variant="outline">Anonymized</Badge>}
							{openWorkflow && (
								<Badge variant="outline" className={STATUS_BADGE_CLASSES.blocked}>
									Ownership {openWorkflow.status === "blocked" ? "Blocked" : "Review Required"}
								</Badge>
							)}
						</div>
					</section>

					{openWorkflow && (
						<PageSection title="Ownership Recovery">
							<div className="space-y-3 text-sm">
								<div className="grid grid-cols-2 gap-2 text-muted-foreground">
									<span>Status</span>
									<span className="font-medium text-foreground">{openWorkflow.status}</span>
									<span>Kind</span>
									<span className="font-medium text-foreground">{openWorkflow.kind}</span>
									{openWorkflow.requester && (
										<>
											<span>Requester</span>
											<span className="font-medium text-foreground">
												{openWorkflow.requester.displayName ?? openWorkflow.requester.userId}
											</span>
										</>
									)}
									{openWorkflow.recoveryTarget && (
										<>
											<span>Recovery Target</span>
											<span className="font-medium text-foreground">
												{openWorkflow.recoveryTarget.displayName ??
													openWorkflow.recoveryTarget.userId}
											</span>
										</>
									)}
								</div>
								<OwnershipResolutionForm workflowId={openWorkflow.id} />
							</div>
						</PageSection>
					)}
				</div>
			</div>
		</PageContainer>
	);
}
