"use client";

import type { RecruitmentApplicationSummary } from "@scrimflow/shared";
import Link from "next/link";
import { useState } from "react";

import { decideRecruitmentApplicationAction } from "@/app/actions/recruit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import {
	getRecruitmentApplicationAcceptLabel,
	RANK_LABELS,
	RECRUITMENT_CATEGORY_LABELS,
	ROLE_LABELS,
	STAFF_ROLE_LABELS,
} from "@/lib/recruitment";
import { appRoutes, publicRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const STAFF_OPTIONS = ["coach", "analyst", "manager", "staff"] as const;
const ROLE_OPTIONS = ["tank", "damage", "support"] as const;

interface RecruitmentApplicationsPanelProps {
	applications: RecruitmentApplicationSummary[];
	teamId?: string;
	organizationId?: string;
	conversationHrefBase?: string;
}

function RecruitmentApplicationCard({
	application,
	teamId,
	organizationId,
	conversationHrefBase,
}: {
	application: RecruitmentApplicationSummary;
	teamId?: string;
	organizationId?: string;
	conversationHrefBase?: string;
}) {
	const [staffRole, setStaffRole] = useState<"coach" | "analyst" | "manager" | "staff">("staff");
	const [gameRole, setGameRole] = useState<"tank" | "damage" | "support">(
		application.senderPrimaryRole ?? "damage"
	);
	const { submit, isPending } = useFormAction(decideRecruitmentApplicationAction, {
		loadingMessage: "Updating application…",
		successMessage: "Application updated",
	});

	function handleDecision(action: "accept" | "reject") {
		const fd = new FormData();
		fd.set("applicationId", application.id);
		fd.set("action", action);
		if (teamId) fd.set("teamId", teamId);
		if (organizationId) fd.set("organizationId", organizationId);
		if (
			action === "accept" &&
			(application.listingCategory === "lfp" || application.listingCategory === "lft")
		) {
			fd.set("gameRole", gameRole);
		}
		if (action === "accept" && application.listingCategory === "lfs") {
			fd.set("staffRole", staffRole);
		}
		submit(fd);
	}

	return (
		<div className="space-y-3 border p-4">
			<div className="flex items-start gap-3">
				<Avatar className="size-9 shrink-0 overflow-hidden rounded-none after:rounded-none">
					<AvatarImage src={application.senderAvatarUrl ?? undefined} className="rounded-none" />
					<AvatarFallback className="rounded-none text-[10px] font-bold">
						{application.senderDisplayName.slice(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<Link
							href={publicRoutes.players.byUsername(application.senderUsername)}
							className="truncate text-sm font-medium hover:underline"
						>
							{application.senderDisplayName}
						</Link>
						{application.senderTeamName && application.senderTeamId && (
							<Link href={publicRoutes.teams.byId(application.senderTeamId)}>
								<Badge variant="outline" className="text-[10px] hover:bg-muted/50">
									[{application.senderTeamTag}] {application.senderTeamName}
								</Badge>
							</Link>
						)}
						{application.senderOrganizationName &&
							!application.senderTeamName &&
							application.senderOrganizationSlug && (
								<Link href={publicRoutes.orgs.bySlug(application.senderOrganizationSlug)}>
									<Badge variant="outline" className="text-[10px] hover:bg-muted/50">
										{application.senderOrganizationName}
									</Badge>
								</Link>
							)}
						<Badge variant="secondary" className="text-[10px]">
							{RECRUITMENT_CATEGORY_LABELS[application.listingCategory]}
						</Badge>
					</div>
					<div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
						{application.senderPrimaryRole && (
							<span>
								{ROLE_LABELS[application.senderPrimaryRole] ?? application.senderPrimaryRole}
							</span>
						)}
						{application.senderRank && (
							<span>{RANK_LABELS[application.senderRank] ?? application.senderRank}</span>
						)}
						<span className="capitalize">{application.status}</span>
					</div>
					{application.message && (
						<p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
							{application.message}
						</p>
					)}
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				{application.listingCategory === "lfp" || application.listingCategory === "lft" ? (
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

				{application.listingCategory === "lfs" ? (
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
					{application.conversationId && (
						<Button asChild size="sm" variant="outline">
							<Link
								href={`${
									conversationHrefBase ?? appRoutes.recruiting.conversations
								}?conversation=${application.conversationId}`}
							>
								Open conversation
							</Link>
						</Button>
					)}
					{application.status === "pending" && (
						<>
							<Button size="sm" onClick={() => handleDecision("accept")} disabled={isPending}>
								{isPending && <Spinner className="mr-1.5" />}
								{getRecruitmentApplicationAcceptLabel(application)}
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

export function RecruitmentApplicationsPanel({
	applications,
	teamId,
	organizationId,
	conversationHrefBase,
}: RecruitmentApplicationsPanelProps) {
	if (applications.length === 0) {
		return <p className="text-xs text-muted-foreground">No applications yet.</p>;
	}

	return (
		<div className="space-y-3">
			{applications.map((application) => (
				<RecruitmentApplicationCard
					key={application.id}
					application={application}
					teamId={teamId}
					organizationId={organizationId}
					conversationHrefBase={conversationHrefBase}
				/>
			))}
		</div>
	);
}
