"use client";

import type { AppRealtimeEvent, UpdatePostSummary } from "@scrimflow/shared";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";
import { apiRoutes } from "@/lib/routes";
import { realtimeSocket } from "@/lib/ws/realtime-socket";
import { CreateUpdatePostDialog } from "./create-update-post-dialog";
import { UpdatePostCard } from "./update-post-card";

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
		function handleEvent(event: AppRealtimeEvent) {
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
			<div className="space-y-4">
				<EmptyStateBlock
					title="No updates posted"
					description="Team announcements and scrim recaps will appear here when managers post them."
					variant="card"
				/>
				{canManage ? (
					<div className="flex justify-start">
						<CreateUpdatePostDialog
							teamId={teamId}
							onCreated={(update) => {
								setUpdates((current) => sortUpdates([update, ...current]));
							}}
						>
							<Button size="sm">Post an update</Button>
						</CreateUpdatePostDialog>
					</div>
				) : (
					<p className="text-sm text-muted-foreground">No team updates have been posted yet.</p>
				)}
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{canManage ? (
				<div className="flex justify-start">
					<CreateUpdatePostDialog
						teamId={teamId}
						onCreated={(update) => {
							setUpdates((current) => sortUpdates([update, ...current]));
						}}
					>
						<Button size="sm">Publish update</Button>
					</CreateUpdatePostDialog>
				</div>
			) : null}

			<div className="space-y-3">
				{updates.map((post) => (
					<UpdatePostCard
						key={post.id}
						post={post}
						actions={
							canManage ? (
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => handleDelete(post.id)}
									disabled={deletingUpdateId === post.id}
								>
									Delete
								</Button>
							) : undefined
						}
					/>
				))}
			</div>
		</div>
	);
}
