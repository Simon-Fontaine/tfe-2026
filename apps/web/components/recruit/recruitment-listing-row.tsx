"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type {
	RecruitmentApplicationReviewSummary,
	RecruitmentListingSummary,
} from "@scrimflow/shared";
import Link from "next/link";
import { useRef, useState } from "react";
import {
	deleteRecruitmentListingAction,
	updateRecruitmentListingStatusAction,
} from "@/app/actions/recruit";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import {
	formatRecruitmentAudience,
	formatRecruitmentCompRange,
	MEMBER_TYPE_LABELS,
	RECRUITMENT_CATEGORY_LABELS,
	RECRUITMENT_STATUS_LABELS,
} from "@/lib/recruitment";
import { cn } from "@/lib/utils";

interface RecruitmentListingRowProps {
	listing: RecruitmentListingSummary;
	applications: RecruitmentApplicationReviewSummary[];
	teamId?: string;
	organizationId?: string;
	canManage: boolean;
	conversationHrefBase?: string;
	detailHref?: string;
}

export function RecruitmentListingRow({
	listing,
	applications,
	teamId,
	organizationId,
	canManage,
	conversationHrefBase,
	detailHref,
}: RecruitmentListingRowProps) {
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [applicationsOpen, setApplicationsOpen] = useState(false);
	const editButtonRef = useRef<HTMLButtonElement>(null);

	const deleteForm = useFormAction(deleteRecruitmentListingAction, {
		loadingMessage: "Deleting listing…",
		successMessage: "Listing deleted",
	});
	const statusForm = useFormAction(updateRecruitmentListingStatusAction, {
		loadingMessage: "Updating listing…",
		successMessage: "Listing updated",
	});

	const isTerminal =
		listing.status === "closed" || listing.status === "fulfilled" || listing.status === "expired";
	const isStatusPending = statusForm.isPending;
	const compRange = formatRecruitmentCompRange(listing) ?? "—";

	function submitDelete() {
		const fd = new FormData();
		fd.set("listingId", listing.id);
		fd.set("ownerType", listing.ownerType);
		if (listing.teamId) fd.set("teamId", listing.teamId);
		if (listing.organizationId) fd.set("organizationId", listing.organizationId);
		deleteForm.submit(fd);
		setDeleteOpen(false);
	}

	function submitStatus(status: "open" | "paused" | "closed" | "fulfilled") {
		const fd = new FormData();
		fd.set("listingId", listing.id);
		fd.set("status", status);
		fd.set("ownerType", listing.ownerType);
		if (listing.teamId) fd.set("teamId", listing.teamId);
		if (listing.organizationId) fd.set("organizationId", listing.organizationId);
		statusForm.submit(fd);
	}

	return (
		<>
			{canManage && !isTerminal && (
				<RecruitmentListingFormDialog
					mode="edit"
					listing={listing}
					fixedOwnerType={listing.ownerType}
					fixedTeamId={teamId ?? listing.teamId ?? undefined}
					fixedOrganizationId={organizationId ?? listing.organizationId ?? undefined}
				>
					<button ref={editButtonRef} type="button" className="sr-only" tabIndex={-1}>
						Edit listing
					</button>
				</RecruitmentListingFormDialog>
			)}
			<div className="grid grid-cols-[minmax(12rem,1.5fr)_repeat(6,minmax(5rem,1fr))_3rem] items-center gap-3 px-4 py-3 text-sm">
				<div className="min-w-0">
					{detailHref ? (
						<Link href={detailHref} className="block truncate font-medium hover:underline">
							{listing.title}
						</Link>
					) : (
						<p className="truncate font-medium">{listing.title}</p>
					)}
					<p className="truncate text-xs text-muted-foreground">
						{listing.region ?? "All regions"}
					</p>
				</div>
				<Badge variant="outline" className="text-[10px]">
					{RECRUITMENT_CATEGORY_LABELS[listing.category]}
				</Badge>
				<Badge variant="outline" className="text-[10px]">
					{formatRecruitmentAudience(listing) || MEMBER_TYPE_LABELS[listing.memberType]}
				</Badge>
				<Badge
					variant="outline"
					className={
						listing.status === "open" ? cn("text-[10px]", STATUS_BADGE_CLASSES.open) : "text-[10px]"
					}
				>
					{RECRUITMENT_STATUS_LABELS[listing.status]}
				</Badge>
				<span className="truncate text-xs text-muted-foreground">{compRange}</span>
				<span className="whitespace-nowrap text-xs text-muted-foreground">
					{applications.length} {applications.length === 1 ? "applicant" : "applicants"}
				</span>
				<span className="whitespace-nowrap text-xs text-muted-foreground">
					{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
						new Date(listing.updatedAt)
					)}
				</span>
				<div className="flex justify-end">
					{detailHref || canManage ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button size="icon" variant="ghost" className="size-8 shrink-0">
									<HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{detailHref ? (
									<DropdownMenuItem asChild>
										<Link href={detailHref}>View listing</Link>
									</DropdownMenuItem>
								) : null}
								{canManage && !isTerminal && (
									<DropdownMenuItem onSelect={() => editButtonRef.current?.click()}>
										Edit listing
									</DropdownMenuItem>
								)}
								{canManage && listing.status === "open" && (
									<DropdownMenuItem
										disabled={isStatusPending}
										onSelect={() => submitStatus("paused")}
									>
										{isStatusPending && <Spinner className="mr-1.5" />}
										Pause
									</DropdownMenuItem>
								)}
								{canManage && listing.status === "paused" && (
									<DropdownMenuItem
										disabled={isStatusPending}
										onSelect={() => submitStatus("open")}
									>
										{isStatusPending && <Spinner className="mr-1.5" />}
										Resume
									</DropdownMenuItem>
								)}
								{canManage && !isTerminal && (
									<DropdownMenuItem
										disabled={isStatusPending}
										onSelect={() => submitStatus("fulfilled")}
									>
										{isStatusPending && <Spinner className="mr-1.5" />}
										Mark Fulfilled
									</DropdownMenuItem>
								)}
								{canManage && !isTerminal && (
									<DropdownMenuItem
										disabled={isStatusPending}
										onSelect={() => submitStatus("closed")}
									>
										{isStatusPending && <Spinner className="mr-1.5" />}
										Close
									</DropdownMenuItem>
								)}
								{canManage && applications.length > 0 && (
									<DropdownMenuItem onSelect={() => setApplicationsOpen(true)}>
										View applications ({applications.length})
									</DropdownMenuItem>
								)}
								{canManage && (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											className="text-destructive"
											disabled={deleteForm.isPending}
											onSelect={() => setDeleteOpen(true)}
										>
											{deleteForm.isPending && <Spinner className="mr-1.5" />}
											Delete
										</DropdownMenuItem>
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
				</div>
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

			<Sheet open={applicationsOpen} onOpenChange={setApplicationsOpen}>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>{listing.title} — Applications</SheetTitle>
					</SheetHeader>
					<RecruitmentApplicationsPanel
						applications={applications}
						teamId={teamId ?? listing.teamId ?? undefined}
						organizationId={organizationId ?? listing.organizationId ?? undefined}
						conversationHrefBase={conversationHrefBase}
					/>
				</SheetContent>
			</Sheet>
		</>
	);
}
