"use client";

import { MoreHorizontalIcon, NewsIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { UpdatePostSummary } from "@scrimflow/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRoutes, appRoutes } from "@/lib/routes";
import { CreateUpdatePostDialog } from "./create-update-post-dialog";
import { EditUpdatePostDialog } from "./edit-update-post-dialog";

function sortUpdates(updates: UpdatePostSummary[]) {
	return [...updates].sort((left, right) => {
		return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
	});
}

function formatTimestamp(value: string) {
	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

interface OrgUpdatesPageClientProps {
	organizationId: string;
	orgName: string;
	orgSlug: string;
	canManage: boolean;
	initialUpdates: UpdatePostSummary[];
}

export function OrgUpdatesPageClient({
	organizationId,
	orgName,
	orgSlug,
	canManage,
	initialUpdates,
}: OrgUpdatesPageClientProps) {
	const [updates, setUpdates] = useState(initialUpdates);
	const [deletingUpdateId, setDeletingUpdateId] = useState<string | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [editingPost, setEditingPost] = useState<UpdatePostSummary | null>(null);

	useEffect(() => {
		setUpdates(initialUpdates);
	}, [initialUpdates]);

	async function handleDelete(updateId: string) {
		if (!canManage || deletingUpdateId) return;

		setDeletingUpdateId(updateId);
		setDeleteError(null);
		try {
			const response = await fetch(apiRoutes.updates.byId(updateId), {
				method: "DELETE",
				credentials: "include",
				headers: { "X-Requested-With": "XMLHttpRequest" },
			});

			if (!response.ok) {
				const payload = await response.json().catch(() => null);
				setDeleteError(
					payload &&
						typeof payload === "object" &&
						"error" in payload &&
						typeof payload.error === "string"
						? payload.error
						: "Unable to delete update."
				);
				return;
			}

			setUpdates((current) => current.filter((update) => update.id !== updateId));
			toast.success("Update deleted.");
		} catch {
			setDeleteError("Unable to reach the API server.");
		} finally {
			setDeletingUpdateId(null);
		}
	}

	const headerAction = canManage ? (
		<CreateUpdatePostDialog
			organizationId={organizationId}
			onCreated={(update) => {
				setUpdates((current) => sortUpdates([update, ...current]));
			}}
		>
			<Button size="sm">Post update</Button>
		</CreateUpdatePostDialog>
	) : undefined;

	const breadcrumbs = (
		<>
			<Link href={appRoutes.orgs.root} className="hover:underline">
				Orgs
			</Link>
			{" / "}
			<Link href={appRoutes.orgs.byId(organizationId)} className="hover:underline">
				{orgName}
			</Link>
			{" / Updates"}
		</>
	);

	if (updates.length === 0) {
		return (
			<>
				<PageHeader
					title="Updates"
					breadcrumbs={breadcrumbs}
					meta={`/${orgSlug} - 0 updates`}
					action={headerAction}
				/>
				<EmptyState icon={NewsIcon} title="No updates posted" />
			</>
		);
	}

	return (
		<>
			<PageHeader
				title="Updates"
				breadcrumbs={breadcrumbs}
				meta={`/${orgSlug} - ${updates.length} updates`}
				action={headerAction}
			/>

			{deleteError ? (
				<p className="border px-3 py-2 text-sm text-destructive">{deleteError}</p>
			) : null}

			<div className="border-t">
				{updates.map((post) => (
					<article key={post.id} className="border-b py-4 text-sm">
						<div className="flex items-start justify-between gap-4">
							<div className="min-w-0 space-y-2">
								<div className="flex flex-wrap items-center gap-2">
									<h2 className="truncate font-medium">{post.title}</h2>
									<Badge variant="outline" className="text-[10px]">
										{post.visibility === "public" ? "Public" : "Workspace only"}
									</Badge>
								</div>
								<p className="text-xs text-muted-foreground">
									{formatTimestamp(post.createdAt)} - {post.authorDisplayName ?? "Unknown author"}
								</p>
							</div>
							{canManage ? (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button size="icon" variant="ghost" className="size-8 shrink-0">
											<HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onSelect={() => setEditingPost(post)}>Edit</DropdownMenuItem>
										<DropdownMenuItem
											className="text-destructive"
											disabled={!!deletingUpdateId}
											onSelect={() => handleDelete(post.id)}
										>
											Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							) : null}
						</div>
						<p className="mt-3 whitespace-pre-wrap leading-relaxed text-foreground/90">
							{post.body}
						</p>
					</article>
				))}
			</div>

			{editingPost ? (
				<EditUpdatePostDialog
					post={editingPost}
					open
					onClose={() => setEditingPost(null)}
					onUpdated={(updated) => {
						setUpdates((current) =>
							sortUpdates(current.map((u) => (u.id === updated.id ? updated : u)))
						);
						setEditingPost(null);
					}}
				/>
			) : null}
		</>
	);
}
