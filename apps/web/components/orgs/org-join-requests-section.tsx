"use client";

import { respondToOrgJoinRequestAction } from "@/app/dashboard/orgs/actions/org";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import type { OrgJoinRequestSummary } from "@/lib/data/organization";

interface OrgJoinRequestsSectionProps {
	orgId: string;
	requests: OrgJoinRequestSummary[];
}

function RequestActions({ orgId, requestId }: { orgId: string; requestId: string }) {
	const { submit, isPending } = useFormAction(respondToOrgJoinRequestAction, {
		loadingMessage: "Updating request…",
		successMessage: "Request updated",
	});

	function respond(action: "approve" | "reject") {
		const fd = new FormData();
		fd.set("orgId", orgId);
		fd.set("requestId", requestId);
		fd.set("action", action);
		submit(fd);
	}

	return (
		<div className="flex gap-2">
			<Button size="sm" onClick={() => respond("approve")} disabled={isPending}>
				{isPending && <Spinner className="mr-1.5" />}
				Approve
			</Button>
			<Button size="sm" variant="outline" onClick={() => respond("reject")} disabled={isPending}>
				Reject
			</Button>
		</div>
	);
}

export function OrgJoinRequestsSection({ orgId, requests }: OrgJoinRequestsSectionProps) {
	if (requests.length === 0) {
		return <p className="text-xs text-muted-foreground">No pending join requests.</p>;
	}

	return (
		<div className="space-y-2">
			{requests.map((request) => (
				<div key={request.id} className="flex items-center gap-3 border px-4 py-3">
					<Avatar className="size-8 shrink-0 overflow-hidden rounded-none after:rounded-none">
						<AvatarImage src={request.requesterAvatarUrl ?? undefined} className="rounded-none" />
						<AvatarFallback className="rounded-none text-[10px] font-bold">
							{request.requesterDisplayName.slice(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<p className="truncate text-xs font-medium">{request.requesterDisplayName}</p>
						<div className="mt-0.5 flex items-center gap-2">
							{request.requesterPrimaryRole && (
								<Badge variant="outline" className="text-[10px] capitalize">
									{request.requesterPrimaryRole}
								</Badge>
							)}
							{request.requesterRank && (
								<Badge variant="secondary" className="text-[10px] capitalize">
									{request.requesterRank}
								</Badge>
							)}
						</div>
						{request.message && (
							<p className="mt-1 text-[11px] text-muted-foreground">{request.message}</p>
						)}
					</div>
					<RequestActions orgId={orgId} requestId={request.id} />
				</div>
			))}
		</div>
	);
}
