"use client";

import { LinkIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { RecruitmentApplicationSummary, RecruitmentListingSummary } from "@scrimflow/shared";
import Link from "next/link";
import { useState } from "react";
import { deleteRecruitmentListingAction } from "@/app/actions/recruit";
import { RecruitmentApplicationDialog } from "@/components/recruit/recruitment-application-dialog";
import { RecruitmentApplicationsPanel } from "@/components/recruit/recruitment-applications-panel";
import { RecruitmentListingFormDialog } from "@/components/recruit/recruitment-listing-form-dialog";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import type { RecruitEntityOption } from "@/lib/recruitment";
import {
	formatRecruitmentAudience,
	formatRecruitmentCompRange,
	formatRecruitmentOwner,
	getRecruitmentApplicationLabel,
	MEMBER_TYPE_LABELS,
	RECRUITMENT_CATEGORY_DESCRIPTIONS,
	RECRUITMENT_CATEGORY_LABELS,
} from "@/lib/recruitment";
import { publicRoutes } from "@/lib/routes";

interface RecruitmentListingCardProps {
	listing: RecruitmentListingSummary;
	currentUserId?: string | null;
	entityOptions?: RecruitEntityOption[];
	applications?: RecruitmentApplicationSummary[];
	teamId?: string;
	organizationId?: string;
	conversationHrefBase?: string;
	detailHref?: string;
}

export function RecruitmentListingCard({
	listing,
	currentUserId,
	entityOptions = [],
	applications,
	teamId,
	organizationId,
	conversationHrefBase,
	detailHref,
}: RecruitmentListingCardProps) {
	const [deleteOpen, setDeleteOpen] = useState(false);
	const deleteForm = useFormAction(deleteRecruitmentListingAction, {
		loadingMessage: "Deleting listing…",
		successMessage: "Listing deleted",
	});
	const ownerLabel = formatRecruitmentOwner(listing);
	const compRange = formatRecruitmentCompRange(listing);
	const canApply = !!currentUserId && listing.canApply && !listing.canManage;
	const ownerHref = listing.teamId
		? publicRoutes.teams.byId(listing.teamId)
		: listing.organizationSlug
			? publicRoutes.orgs.bySlug(listing.organizationSlug)
			: publicRoutes.players.byUsername(listing.ownerUsername);

	function submitDelete() {
		const fd = new FormData();
		fd.set("listingId", listing.id);
		fd.set("ownerType", listing.ownerType);
		if (listing.teamId) fd.set("teamId", listing.teamId);
		if (listing.organizationId) fd.set("organizationId", listing.organizationId);
		deleteForm.submit(fd);
		setDeleteOpen(false);
	}

	return (
		<>
			<div className="space-y-4 border p-4">
				<div className="flex items-start gap-3">
					<Link href={ownerHref} tabIndex={-1}>
						<Avatar className="size-10 shrink-0 overflow-hidden rounded-none after:rounded-none">
							<AvatarImage
								src={
									listing.teamAvatarUrl ??
									listing.organizationAvatarUrl ??
									listing.ownerAvatarUrl ??
									undefined
								}
								className="rounded-none"
							/>
							<AvatarFallback className="rounded-none text-[10px] font-bold">
								{ownerLabel.slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
					</Link>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							{detailHref ? (
								<Link
									href={detailHref}
									className="block truncate text-sm font-semibold hover:underline"
								>
									{listing.title}
								</Link>
							) : (
								<p className="truncate text-sm font-semibold">{listing.title}</p>
							)}
							<Badge variant="secondary" className="text-[10px]">
								{RECRUITMENT_CATEGORY_LABELS[listing.category]}
							</Badge>
							<Badge variant="outline" className="text-[10px]">
								{MEMBER_TYPE_LABELS[listing.memberType]}
							</Badge>
							<Badge variant="outline" className="text-[10px] capitalize">
								{listing.status}
							</Badge>
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							<Link href={ownerHref} className="hover:underline">
								{ownerLabel}
							</Link>
							{" · "}
							{RECRUITMENT_CATEGORY_DESCRIPTIONS[listing.category]}
						</p>
						{listing.description && (
							<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
								{listing.description}
							</p>
						)}
					</div>
				</div>

				<div className="flex flex-wrap gap-2">
					<Badge variant="outline" className="text-[10px]">
						{formatRecruitmentAudience(listing)}
					</Badge>
					{compRange && (
						<Badge variant="outline" className="text-[10px]">
							{compRange}
						</Badge>
					)}
					{listing.region && (
						<Badge variant="outline" className="text-[10px]">
							{listing.region}
						</Badge>
					)}
					<Badge variant="secondary" className="text-[10px]">
						{listing.applicationCount} application{listing.applicationCount === 1 ? "" : "s"}
					</Badge>
					{listing.hasApplied && !listing.canManage && (
						<Badge variant="secondary" className="text-[10px]">
							Application sent
						</Badge>
					)}
				</div>

				<div className="flex flex-wrap gap-2">
					{canApply ? (
						<RecruitmentApplicationDialog
							listing={listing}
							entityOptions={entityOptions}
							conversationHrefBase={conversationHrefBase}
						>
							<Button size="sm">{getRecruitmentApplicationLabel(listing)}</Button>
						</RecruitmentApplicationDialog>
					) : null}

					{!currentUserId && (
						<Button asChild size="sm" variant="outline">
							<Link href={publicRoutes.auth.step("login")}>
								<HugeiconsIcon icon={LinkIcon} strokeWidth={2} className="mr-1.5 size-4" />
								Sign in to apply
							</Link>
						</Button>
					)}

					{listing.canManage && (
						<>
							<RecruitmentListingFormDialog
								mode="edit"
								listing={listing}
								ownerOptions={entityOptions}
								fixedOwnerType={listing.ownerType}
								fixedTeamId={teamId ?? listing.teamId ?? undefined}
								fixedOrganizationId={organizationId ?? listing.organizationId ?? undefined}
								triggerContent="Edit listing"
								triggerVariant="outline"
							/>
							<Button
								size="sm"
								variant="outline"
								onClick={() => setDeleteOpen(true)}
								disabled={deleteForm.isPending}
							>
								{deleteForm.isPending && <Spinner className="mr-1.5" />}
								Delete
							</Button>
						</>
					)}
				</div>

				{applications !== undefined && (
					<div className="space-y-3 border-t pt-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Applications
						</p>
						<RecruitmentApplicationsPanel
							applications={applications}
							teamId={teamId ?? listing.teamId ?? undefined}
							organizationId={organizationId ?? listing.organizationId ?? undefined}
							conversationHrefBase={conversationHrefBase}
						/>
					</div>
				)}
			</div>

			<AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this listing?</AlertDialogTitle>
						<AlertDialogDescription>
							This removes the listing from recruiting and cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<Button size="sm" variant="destructive" onClick={submitDelete}>
							Delete
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
