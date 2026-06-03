"use client";

import type { RecruitmentApplicationReviewSummary } from "@scrimflow/shared";
import { appRoutes, publicRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
	decideRecruitmentApplicationAction,
	requestApplicationFollowUpAction,
	toggleApplicationShortlistAction,
	updateApplicationReviewNotesAction,
} from "@/app/actions/recruit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import {
	APPLICATION_STATUS_LABELS,
	getRecruitmentApplicationAcceptLabel,
	RANK_LABELS,
	RECRUITMENT_CATEGORY_LABELS,
	ROLE_LABELS,
	STAFF_ROLE_LABELS,
} from "@/lib/recruitment";
import { cn } from "@/lib/utils";

const STAFF_OPTIONS = ["coach", "analyst", "manager", "staff"] as const;
const ROLE_OPTIONS = ["tank", "damage", "support"] as const;

export interface RecruitmentApplicationsPanelProps {
	applications: RecruitmentApplicationReviewSummary[];
	teamId?: string;
	organizationId?: string;
	conversationHrefBase?: string;
}

function RecruitmentApplicationCard({
	application,
	teamId,
	organizationId,
	conversationHrefBase,
	isSettled,
}: {
	application: RecruitmentApplicationReviewSummary;
	teamId?: string;
	organizationId?: string;
	conversationHrefBase?: string;
	isSettled: boolean;
}) {
	const [staffRole, setStaffRole] = useState<"coach" | "analyst" | "manager" | "staff">("staff");
	const [gameRole, setGameRole] = useState<"tank" | "damage" | "support">(
		application.senderPrimaryRole ?? "damage"
	);
	const [isEditingNotes, setIsEditingNotes] = useState(false);
	const [draftNotes, setDraftNotes] = useState(application.reviewerNotes ?? "");
	const [isShortlisted, setIsShortlisted] = useState(application.isShortlisted);

	const { submit: submitDecide, isPending: isDecidePending } = useFormAction(
		decideRecruitmentApplicationAction,
		{
			loadingMessage: "Updating application…",
			successMessage: "Application updated",
		}
	);
	const {
		submit: submitShortlist,
		isPending: isShortlistPending,
		state: shortlistState,
	} = useFormAction(toggleApplicationShortlistAction, {
		loadingMessage: "Updating…",
		successMessage: isShortlisted ? "Removed from shortlist" : "Shortlisted",
	});
	const { submit: submitFollowUp, isPending: isFollowUpPending } = useFormAction(
		requestApplicationFollowUpAction,
		{ successMessage: "Follow-up requested — conversation opened" }
	);
	const {
		submit: submitNotes,
		isPending: isNotesPending,
		state: notesState,
	} = useFormAction(updateApplicationReviewNotesAction, { successMessage: "Notes saved" });

	useEffect(() => {
		if (notesState?.success) setIsEditingNotes(false);
	}, [notesState]);

	useEffect(() => {
		if (shortlistState?.success) setIsShortlisted((prev) => !prev);
	}, [shortlistState]);

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
		submitDecide(fd);
	}

	function handleShortlist() {
		const fd = new FormData();
		fd.set("applicationId", application.id);
		if (teamId) fd.set("teamId", teamId);
		if (organizationId) fd.set("organizationId", organizationId);
		submitShortlist(fd);
	}

	function handleFollowUp() {
		const fd = new FormData();
		fd.set("applicationId", application.id);
		if (teamId) fd.set("teamId", teamId);
		if (organizationId) fd.set("organizationId", organizationId);
		submitFollowUp(fd);
	}

	function handleSaveNotes() {
		const fd = new FormData();
		fd.set("applicationId", application.id);
		fd.set("reviewerNotes", draftNotes);
		if (teamId) fd.set("teamId", teamId);
		if (organizationId) fd.set("organizationId", organizationId);
		submitNotes(fd);
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
						<Badge variant="outline" className="text-[10px]">
							{RECRUITMENT_CATEGORY_LABELS[application.listingCategory]}
						</Badge>
						{isShortlisted && (
							<Badge variant="outline" className="text-[10px]">
								Shortlisted
							</Badge>
						)}
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
						<span>{APPLICATION_STATUS_LABELS[application.status]}</span>
					</div>
					{application.message && (
						<p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
							{application.message}
						</p>
					)}
				</div>
			</div>

			{!isSettled && (
				<>
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
				</>
			)}

			<div className="flex flex-wrap items-center gap-2">
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

				{!isSettled && (
					<>
						<Button
							size="sm"
							variant={isShortlisted ? "secondary" : "outline"}
							onClick={handleShortlist}
							disabled={isShortlistPending}
						>
							{isShortlistPending && <Spinner className="mr-1.5" />}
							{isShortlisted ? "Shortlisted" : "Shortlist"}
						</Button>
						{shortlistState?.error && (
							<p className="w-full text-[11px] text-destructive">{shortlistState.error}</p>
						)}

						{application.conversationId && (
							<Button
								size="sm"
								variant="outline"
								onClick={handleFollowUp}
								disabled={isFollowUpPending}
							>
								{isFollowUpPending && <Spinner className="mr-1.5" />}
								Request follow-up
							</Button>
						)}

						<div className="ml-auto flex flex-wrap gap-2">
							<Button size="sm" onClick={() => handleDecision("accept")} disabled={isDecidePending}>
								{isDecidePending && <Spinner className="mr-1.5" />}
								{getRecruitmentApplicationAcceptLabel(application)}
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => handleDecision("reject")}
								disabled={isDecidePending}
							>
								Reject
							</Button>
						</div>
					</>
				)}
			</div>

			<div className="border-t pt-3">
				{isEditingNotes ? (
					<div className="space-y-2">
						<p className="text-[11px] font-medium text-muted-foreground">Internal notes</p>
						<Textarea
							value={draftNotes}
							onChange={(e) => setDraftNotes(e.target.value)}
							placeholder="Add internal notes about this applicant…"
							className="min-h-[80px] text-xs"
							maxLength={2000}
						/>
						{notesState?.error && (
							<p className="text-[11px] text-destructive">{notesState.error}</p>
						)}
						<div className="flex gap-2">
							<Button size="sm" onClick={handleSaveNotes} disabled={isNotesPending}>
								{isNotesPending && <Spinner className="mr-1.5" />}
								Save
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => {
									setDraftNotes(application.reviewerNotes ?? "");
									setIsEditingNotes(false);
								}}
							>
								Cancel
							</Button>
						</div>
					</div>
				) : (
					<button
						type="button"
						className="text-[11px] text-muted-foreground hover:text-foreground"
						onClick={() => setIsEditingNotes(true)}
					>
						{application.reviewerNotes
							? `Notes: ${application.reviewerNotes.slice(0, 80)}${application.reviewerNotes.length > 80 ? "…" : ""}`
							: "Add internal notes"}
					</button>
				)}
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

	const pending = applications.filter((a) => a.status === "pending");
	const settled = applications.filter((a) => a.status !== "pending");

	return (
		<div className="space-y-3">
			{pending.map((application) => (
				<RecruitmentApplicationCard
					key={application.id}
					application={application}
					teamId={teamId}
					organizationId={organizationId}
					conversationHrefBase={conversationHrefBase}
					isSettled={false}
				/>
			))}
			{settled.length > 0 && (
				<>
					{pending.length > 0 && <div className="border-t" />}
					<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
						Settled
					</p>
					{settled.map((application) => (
						<RecruitmentApplicationCard
							key={application.id}
							application={application}
							teamId={teamId}
							organizationId={organizationId}
							conversationHrefBase={conversationHrefBase}
							isSettled={true}
						/>
					))}
				</>
			)}
		</div>
	);
}
