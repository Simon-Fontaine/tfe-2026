"use client";

import { LinkIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { RecruitmentPostSummary, RecruitmentResponseSummary } from "@scrimflow/shared";
import { useState } from "react";

import { deleteRecruitmentPostAction } from "@/app/dashboard/recruit/actions/recruit";
import { RecruitmentPostFormDialog } from "@/components/recruit/recruitment-post-form-dialog";
import { RecruitmentResponseDialog } from "@/components/recruit/recruitment-response-dialog";
import { RecruitmentResponsesPanel } from "@/components/recruit/recruitment-responses-panel";
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
	getPostResponseLabel,
	MEMBER_TYPE_LABELS,
	RECRUITMENT_CATEGORY_DESCRIPTIONS,
	RECRUITMENT_CATEGORY_LABELS,
} from "@/lib/recruitment";

interface RecruitmentPostCardProps {
	post: RecruitmentPostSummary;
	currentUserId?: string | null;
	entityOptions?: RecruitEntityOption[];
	responses?: RecruitmentResponseSummary[];
	teamId?: string;
	organizationId?: string;
}

export function RecruitmentPostCard({
	post,
	currentUserId,
	entityOptions = [],
	responses,
	teamId,
	organizationId,
}: RecruitmentPostCardProps) {
	const [deleteOpen, setDeleteOpen] = useState(false);
	const deleteForm = useFormAction(deleteRecruitmentPostAction, {
		loadingMessage: "Deleting post…",
		successMessage: "Post deleted",
	});
	const ownerLabel = formatRecruitmentOwner(post);
	const compRange = formatRecruitmentCompRange(post);
	const canRespond = !!currentUserId && post.canRespond && !post.canManage;

	function submitDelete() {
		const fd = new FormData();
		fd.set("postId", post.id);
		fd.set("ownerType", post.ownerType);
		if (post.teamId) fd.set("teamId", post.teamId);
		if (post.organizationId) fd.set("organizationId", post.organizationId);
		deleteForm.submit(fd);
		setDeleteOpen(false);
	}

	return (
		<>
			<div className="space-y-4 border p-4">
				<div className="flex items-start gap-3">
					<Avatar className="size-10 shrink-0 overflow-hidden rounded-none after:rounded-none">
						<AvatarImage
							src={
								post.teamAvatarUrl ?? post.organizationAvatarUrl ?? post.ownerAvatarUrl ?? undefined
							}
							className="rounded-none"
						/>
						<AvatarFallback className="rounded-none text-[10px] font-bold">
							{ownerLabel.slice(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<p className="truncate text-sm font-semibold">{post.title}</p>
							<Badge variant="secondary" className="text-[10px]">
								{RECRUITMENT_CATEGORY_LABELS[post.category]}
							</Badge>
							<Badge variant="outline" className="text-[10px]">
								{MEMBER_TYPE_LABELS[post.memberType]}
							</Badge>
							<Badge variant="outline" className="text-[10px] capitalize">
								{post.status}
							</Badge>
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							{ownerLabel} · {RECRUITMENT_CATEGORY_DESCRIPTIONS[post.category]}
						</p>
						{post.description && (
							<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
								{post.description}
							</p>
						)}
					</div>
				</div>

				<div className="flex flex-wrap gap-2">
					<Badge variant="outline" className="text-[10px]">
						{formatRecruitmentAudience(post)}
					</Badge>
					{compRange && (
						<Badge variant="outline" className="text-[10px]">
							{compRange}
						</Badge>
					)}
					{post.region && (
						<Badge variant="outline" className="text-[10px]">
							{post.region}
						</Badge>
					)}
					<Badge variant="secondary" className="text-[10px]">
						{post.responseCount} response{post.responseCount === 1 ? "" : "s"}
					</Badge>
					{post.hasResponded && !post.canManage && (
						<Badge variant="secondary" className="text-[10px]">
							Response sent
						</Badge>
					)}
				</div>

				<div className="flex flex-wrap gap-2">
					{canRespond ? (
						<RecruitmentResponseDialog post={post} entityOptions={entityOptions}>
							<Button size="sm">{getPostResponseLabel(post)}</Button>
						</RecruitmentResponseDialog>
					) : null}

					{!currentUserId && (
						<Button asChild size="sm" variant="outline">
							<a href="/auth?step=login">
								<HugeiconsIcon icon={LinkIcon} strokeWidth={2} className="mr-1.5 size-4" />
								Sign in to respond
							</a>
						</Button>
					)}

					{post.canManage && (
						<>
							<RecruitmentPostFormDialog
								mode="edit"
								post={post}
								ownerOptions={entityOptions}
								fixedOwnerType={post.ownerType}
								fixedTeamId={teamId ?? post.teamId ?? undefined}
								fixedOrganizationId={organizationId ?? post.organizationId ?? undefined}
							>
								<Button size="sm" variant="outline">
									Edit post
								</Button>
							</RecruitmentPostFormDialog>
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

				{responses !== undefined && (
					<div className="space-y-3 border-t pt-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Responses
						</p>
						<RecruitmentResponsesPanel
							responses={responses}
							teamId={teamId ?? post.teamId ?? undefined}
							organizationId={organizationId ?? post.organizationId ?? undefined}
						/>
					</div>
				)}
			</div>

			<AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this post?</AlertDialogTitle>
						<AlertDialogDescription>
							This removes the post from recruiting and cannot be undone.
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
