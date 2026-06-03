import type { GovernancePendingItem, GovernancePendingResponse } from "@scrimflow/shared";
import { apiRoutes, appRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { apiGet } from "@/lib/api-client";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

function GovernanceItemRow({ item }: { item: GovernancePendingItem }) {
	const href = appRoutes.moderation.governance.entity(item.entityType, item.entityId);
	const entityTypeLabel =
		item.entityType === "user" ? "User" : item.entityType === "team" ? "Team" : "Org";
	const reasonLabel = item.reason === "blocked_ownership" ? "Blocked ownership" : "Suspended";
	const statusLabel =
		item.reason === "blocked_ownership"
			? item.workflowStatus === "blocked"
				? "Blocked"
				: "Review Required"
			: "Suspended";
	const statusClass =
		item.reason === "blocked_ownership"
			? STATUS_BADGE_CLASSES.blocked
			: STATUS_BADGE_CLASSES.suspended;

	return (
		<tr className="text-sm">
			<td className="py-2">
				<Link href={href} className="font-medium hover:underline">
					{item.displayName}
				</Link>
			</td>
			<td className="py-2">
				<Badge variant="outline" className="text-xs">
					{entityTypeLabel}
				</Badge>
			</td>
			<td className="py-2 text-muted-foreground">{reasonLabel}</td>
			<td className="py-2">
				<Badge variant="outline" className={statusClass}>
					{statusLabel}
				</Badge>
			</td>
			<td className="py-2 text-xs text-muted-foreground">
				{new Date(item.since).toLocaleDateString()}
			</td>
		</tr>
	);
}

interface GovernancePageProps {
	searchParams: Promise<{ cursor?: string }>;
}

export default async function GovernancePage({ searchParams }: GovernancePageProps) {
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

	const { cursor } = await searchParams;
	const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
	const res = await apiGet<GovernancePendingResponse>(
		`${apiRoutes.moderation.governance.pending}${query}`
	);
	const data = "data" in res ? res.data : null;
	const items = data?.items ?? [];
	const nextCursor = data?.nextCursor ?? null;

	return (
		<PageContainer>
			<PageHeader title="Governance" />

			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b text-left">
							<th className="pb-2 text-xs font-medium text-muted-foreground">Entity</th>
							<th className="pb-2 text-xs font-medium text-muted-foreground">Type</th>
							<th className="pb-2 text-xs font-medium text-muted-foreground">Reason</th>
							<th className="pb-2 text-xs font-medium text-muted-foreground">Status</th>
							<th className="pb-2 text-xs font-medium text-muted-foreground">Since</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{items.length === 0 ? (
							<tr>
								<td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
									No governance items require attention.
								</td>
							</tr>
						) : (
							items.map((item) => (
								<GovernanceItemRow key={item.workflowId ?? item.entityId} item={item} />
							))
						)}
					</tbody>
				</table>
			</div>

			{nextCursor && (
				<div className="mt-4">
					<Link
						href={`${appRoutes.moderation.governance.root}?cursor=${encodeURIComponent(nextCursor)}`}
						className="text-sm text-primary underline-offset-2 hover:underline"
					>
						Load more
					</Link>
				</div>
			)}
		</PageContainer>
	);
}
