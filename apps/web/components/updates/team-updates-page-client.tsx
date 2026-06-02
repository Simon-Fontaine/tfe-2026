"use client";

import { Megaphone01Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { RealtimeEvent, UpdatePostSummary } from "@scrimflow/shared";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRoutes } from "@/lib/routes";
import { realtimeSocket } from "@/lib/ws/realtime-socket";
import { CreateUpdatePostDialog } from "./create-update-post-dialog";
import { EditUpdatePostDialog } from "./edit-update-post-dialog";

function sortUpdates(updates: UpdatePostSummary[]) {
	return [...updates].sort((left, right) => {
		return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
	});
}

interface TeamUpdatesPageClientProps {
	teamId: string;
	canManage: boolean;
	initialUpdates: UpdatePostSummary[];
}

export function TeamUpdatesPageClient({
	teamId,
	canManage,
	initialUpdates,
}: TeamUpdatesPageClientProps) {
	const [updates, setUpdates] = useState(initialUpdates);
	const [deletingUpdateId, setDeletingUpdateId] = useState<string | null>(null);

	useEffect(() => {
		setUpdates(initialUpdates);
	}, [initialUpdates]);

	useEffect(() => {
		function handleEvent(event: RealtimeEvent) {
			if (!("teamId" in event) || event.teamId !== teamId) return;

			switch (event.type) {
				case "update:created":
					setUpdates((current) =>
						sortUpdates([
							event.update,
							...current.filter((update) => update.id !== event.update.id),
						])
					);
					break;
				case "update:updated":
					setUpdates((current) =>
						sortUpdates(
							current.map((update) => (update.id === event.update.id ? event.update : update))
						)
					);
					break;
				case "update:deleted":
					setUpdates((current) => current.filter((update) => update.id !== event.updateId));
					break;
				default:
					break;
			}
		}

		realtimeSocket.subscribeTeam(teamId);
		const removeListener = realtimeSocket.addListener(handleEvent);

		return () => {
			removeListener();
			realtimeSocket.unsubscribeTeam(teamId);
		};
	}, [teamId]);

	async function handleDelete(updateId: string) {
		if (!canManage || deletingUpdateId) return;

		setDeletingUpdateId(updateId);
		try {
			const response = await fetch(apiRoutes.updates.byId(updateId), {
				method: "DELETE",
				credentials: "include",
				headers: { "X-Requested-With": "XMLHttpRequest" },
			});

			if (!response.ok) {
				const payload = await response.json().catch(() => null);
				toast.error(
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
			toast.error("Unable to reach the API server.");
		} finally {
			setDeletingUpdateId(null);
		}
	}

	if (updates.length === 0) {
		return (
			<EmptyState
				icon={Megaphone01Icon}
				title="No updates posted."
				action={
					canManage ? (
						<CreateUpdatePostDialog
							teamId={teamId}
							onCreated={(update) => {
								setUpdates((current) => sortUpdates([update, ...current]));
							}}
						>
							<Button size="sm">Publish update</Button>
						</CreateUpdatePostDialog>
					) : undefined
				}
			/>
		);
	}

	return (
		<>
			{canManage && (
				<div className="mb-4 flex justify-end">
					<CreateUpdatePostDialog
						teamId={teamId}
						onCreated={(update) => {
							setUpdates((current) => sortUpdates([update, ...current]));
						}}
					>
						<Button size="sm">Publish update</Button>
					</CreateUpdatePostDialog>
				</div>
			)}
			<div className="divide-y">
				{updates.map((post) => (
					<UpdateListItem
						key={post.id}
						post={post}
						canManage={canManage}
						onEdit={(updated) =>
							setUpdates((curr) =>
								sortUpdates(curr.map((u) => (u.id === updated.id ? updated : u)))
							)
						}
						onDelete={(id) => handleDelete(id)}
						deletingId={deletingUpdateId}
					/>
				))}
			</div>
		</>
	);
}

interface UpdateListItemProps {
	post: UpdatePostSummary;
	canManage: boolean;
	onEdit: (updated: UpdatePostSummary) => void;
	onDelete: (id: string) => void;
	deletingId: string | null;
}

function UpdateListItem({ post, canManage, onEdit, onDelete, deletingId }: UpdateListItemProps) {
	const editTriggerRef = useRef<HTMLButtonElement>(null);

	const timestamp = new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
	}).format(new Date(post.createdAt));

	return (
		<div className="flex items-start justify-between gap-4 py-3">
			<div className="min-w-0 flex-1 space-y-1">
				<p className="truncate text-sm font-medium">{post.title}</p>
				<p className="text-xs text-muted-foreground">
					{timestamp}
					{post.authorDisplayName ? ` · ${post.authorDisplayName}` : ""}
				</p>
			</div>
			{canManage && (
				<>
					<EditUpdatePostDialog post={post} onUpdated={onEdit}>
						<button ref={editTriggerRef} type="button" className="sr-only" tabIndex={-1}>
							Edit
						</button>
					</EditUpdatePostDialog>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button size="icon" variant="ghost" className="size-8 shrink-0">
								<HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onSelect={() => editTriggerRef.current?.click()}>
								Edit
							</DropdownMenuItem>
							<DropdownMenuItem
								className="text-destructive"
								disabled={deletingId === post.id}
								onSelect={() => onDelete(post.id)}
							>
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</>
			)}
		</div>
	);
}
