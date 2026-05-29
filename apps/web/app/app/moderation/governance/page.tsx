import type { GovernancePendingItem, GovernancePendingResponse } from "@scrimflow/shared";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { apiGet } from "@/lib/api-client";
import { apiRoutes, appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

function GovernanceItemRow({ item }: { item: GovernancePendingItem }) {
	const href = appRoutes.moderation.governance.entity(item.entityType, item.entityId);
	const statusLabel =
		item.reason === "blocked_ownership"
			? item.workflowStatus === "blocked"
				? "Blocked"
				: "Review Required"
			: "Suspended";
	const statusVariant = item.reason === "blocked_ownership" ? "destructive" : "secondary";
	const entityTypeLabel =
		item.entityType === "user" ? "User" : item.entityType === "team" ? "Team" : "Org";

	return (
		<div className="flex items-center justify-between gap-4 py-2">
			<div className="flex items-center gap-3">
				<Link href={href} className="text-sm font-medium hover:underline">
					{item.displayName}
				</Link>
				<Badge variant="outline" className="text-xs">
					{entityTypeLabel}
				</Badge>
				<Badge variant={statusVariant} className="text-xs">
					{statusLabel}
				</Badge>
			</div>
			<span className="text-xs text-muted-foreground">
				Since {new Date(item.since).toLocaleDateString()}
			</span>
		</div>
	);
}

export default async function GovernancePage() {
	const { user } = await requireWorkspaceSession();

	if (!user.isModerator) {
		return (
			<AccessGate
				title="Governance Recovery"
				resourceType="moderation"
				description="You must be a moderator to access governance recovery."
			/>
		);
	}

	const res = await apiGet<GovernancePendingResponse>(apiRoutes.moderation.governance.pending);
	const data = "data" in res ? res.data : null;
	const items = data?.items ?? [];

	const pendingWorkflows = items.filter((item) => item.reason === "blocked_ownership");
	const suspendedUsers = items.filter(
		(item) => item.reason === "suspended" && item.entityType === "user"
	);
	const suspendedTeams = items.filter(
		(item) => item.reason === "suspended" && item.entityType === "team"
	);
	const suspendedOrgs = items.filter(
		(item) => item.reason === "suspended" && item.entityType === "organization"
	);

	return (
		<PageContainer>
			<PageHeader title="Governance Recovery" />

			<PageSection title="Blocked Ownership Workflows">
				{pendingWorkflows.length === 0 ? (
					<p className="text-sm text-muted-foreground">No items require attention.</p>
				) : (
					<div className="divide-y">
						{pendingWorkflows.map((item) => (
							<GovernanceItemRow key={item.workflowId ?? item.entityId} item={item} />
						))}
					</div>
				)}
			</PageSection>

			<PageSection title="Suspended Users">
				{suspendedUsers.length === 0 ? (
					<p className="text-sm text-muted-foreground">No items require attention.</p>
				) : (
					<div className="divide-y">
						{suspendedUsers.map((item) => (
							<GovernanceItemRow key={item.entityId} item={item} />
						))}
					</div>
				)}
			</PageSection>

			<PageSection title="Suspended Teams">
				{suspendedTeams.length === 0 ? (
					<p className="text-sm text-muted-foreground">No items require attention.</p>
				) : (
					<div className="divide-y">
						{suspendedTeams.map((item) => (
							<GovernanceItemRow key={item.entityId} item={item} />
						))}
					</div>
				)}
			</PageSection>

			<PageSection title="Suspended Organizations">
				{suspendedOrgs.length === 0 ? (
					<p className="text-sm text-muted-foreground">No items require attention.</p>
				) : (
					<div className="divide-y">
						{suspendedOrgs.map((item) => (
							<GovernanceItemRow key={item.entityId} item={item} />
						))}
					</div>
				)}
			</PageSection>
		</PageContainer>
	);
}
