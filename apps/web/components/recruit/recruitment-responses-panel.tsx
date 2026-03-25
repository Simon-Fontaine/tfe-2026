"use client";

import type { RecruitmentResponseSummary } from "@scrimflow/shared";
import Link from "next/link";
import { useState } from "react";

import { decideRecruitmentResponseAction } from "@/app/dashboard/recruit/actions/recruit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import {
	getResponseAcceptLabel,
	RANK_LABELS,
	RECRUITMENT_CATEGORY_LABELS,
	ROLE_LABELS,
	STAFF_ROLE_LABELS,
} from "@/lib/recruitment";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const STAFF_OPTIONS = ["coach", "analyst", "manager", "staff"] as const;
const ROLE_OPTIONS = ["tank", "damage", "support"] as const;

interface RecruitmentResponsesPanelProps {
	responses: RecruitmentResponseSummary[];
	teamId?: string;
	organizationId?: string;
}

function RecruitmentResponseCard({
	response,
	teamId,
	organizationId,
}: {
	response: RecruitmentResponseSummary;
	teamId?: string;
	organizationId?: string;
}) {
	const [staffRole, setStaffRole] = useState<"coach" | "analyst" | "manager" | "staff">("staff");
	const [gameRole, setGameRole] = useState<"tank" | "damage" | "support">(
		response.senderPrimaryRole ?? "damage"
	);
	const { submit, isPending } = useFormAction(decideRecruitmentResponseAction, {
		loadingMessage: "Updating response…",
		successMessage: "Response updated",
	});

	function handleDecision(action: "accept" | "reject") {
		const fd = new FormData();
		fd.set("responseId", response.id);
		fd.set("action", action);
		if (teamId) fd.set("teamId", teamId);
		if (organizationId) fd.set("organizationId", organizationId);
		if (
			action === "accept" &&
			(response.postCategory === "lfp" || response.postCategory === "lft")
		) {
			fd.set("gameRole", gameRole);
		}
		if (action === "accept" && response.postCategory === "lfs") {
			fd.set("staffRole", staffRole);
		}
		submit(fd);
	}

	return (
		<div className="space-y-3 border p-4">
			<div className="flex items-start gap-3">
				<Avatar className="size-9 shrink-0 overflow-hidden rounded-none after:rounded-none">
					<AvatarImage src={response.senderAvatarUrl ?? undefined} className="rounded-none" />
					<AvatarFallback className="rounded-none text-[10px] font-bold">
						{response.senderDisplayName.slice(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<p className="truncate text-sm font-medium">{response.senderDisplayName}</p>
						{response.senderTeamName && (
							<Badge variant="outline" className="text-[10px]">
								[{response.senderTeamTag}] {response.senderTeamName}
							</Badge>
						)}
						{response.senderOrganizationName && !response.senderTeamName && (
							<Badge variant="outline" className="text-[10px]">
								{response.senderOrganizationName}
							</Badge>
						)}
						<Badge variant="secondary" className="text-[10px]">
							{RECRUITMENT_CATEGORY_LABELS[response.postCategory]}
						</Badge>
					</div>
					<div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
						{response.senderPrimaryRole && (
							<span>{ROLE_LABELS[response.senderPrimaryRole] ?? response.senderPrimaryRole}</span>
						)}
						{response.senderRank && (
							<span>{RANK_LABELS[response.senderRank] ?? response.senderRank}</span>
						)}
						<span className="capitalize">{response.status}</span>
					</div>
					{response.message && (
						<p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
							{response.message}
						</p>
					)}
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				{response.postCategory === "lfp" || response.postCategory === "lft" ? (
					<div className="flex flex-wrap gap-2">
						{ROLE_OPTIONS.map((option) => (
							<button
								key={option}
								type="button"
								data-selected={gameRole === option}
								onClick={() => setGameRole(option)}
								className={cn(
									"border px-2.5 py-1 text-[10px] font-medium transition-colors hover:bg-muted",
									"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
								)}
							>
								{ROLE_LABELS[option]}
							</button>
						))}
					</div>
				) : null}

				{response.postCategory === "lfs" ? (
					<div className="flex flex-wrap gap-2">
						{STAFF_OPTIONS.map((option) => (
							<button
								key={option}
								type="button"
								data-selected={staffRole === option}
								onClick={() => setStaffRole(option)}
								className={cn(
									"border px-2.5 py-1 text-[10px] font-medium transition-colors hover:bg-muted",
									"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
								)}
							>
								{STAFF_ROLE_LABELS[option]}
							</button>
						))}
					</div>
				) : null}

				<div className="ml-auto flex flex-wrap gap-2">
					{response.threadId && (
						<Button asChild size="sm" variant="outline">
							<Link href={`${dashboardRoutes.recruit.conversations}?thread=${response.threadId}`}>
								Open conversation
							</Link>
						</Button>
					)}
					{response.status === "pending" && (
						<>
							<Button size="sm" onClick={() => handleDecision("accept")} disabled={isPending}>
								{isPending && <Spinner className="mr-1.5" />}
								{getResponseAcceptLabel(response)}
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => handleDecision("reject")}
								disabled={isPending}
							>
								Reject
							</Button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

export function RecruitmentResponsesPanel({
	responses,
	teamId,
	organizationId,
}: RecruitmentResponsesPanelProps) {
	if (responses.length === 0) {
		return <p className="text-xs text-muted-foreground">No responses yet.</p>;
	}

	return (
		<div className="space-y-3">
			{responses.map((response) => (
				<RecruitmentResponseCard
					key={response.id}
					response={response}
					teamId={teamId}
					organizationId={organizationId}
				/>
			))}
		</div>
	);
}
