"use client";

import type { UpdatePostSummary } from "@scrimflow/shared";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";
import { apiRoutes } from "@/lib/routes";
import { CreateUpdatePostDialog } from "./create-update-post-dialog";
import { EditUpdatePostDialog } from "./edit-update-post-dialog";
import { UpdatePostCard } from "./update-post-card";

function sortUpdates(updates: UpdatePostSummary[]) {
	return [...updates].sort((left, right) => {
		return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
	});
}

interface OrgUpdatesPageClientProps {
	organizationId: string;
	canManage: boolean;
	initialUpdates: UpdatePostSummary[];
}

export function OrgUpdatesPageClient({
	organizationId,
	canManage,
	initialUpdates,
}: OrgUpdatesPageClientProps) {
	const [updates, setUpdates] = useState(initialUpdates);
	const [deletingUpdateId, setDeletingUpdateId] = useState<string | null>(null);

	useEffect(() => {
		setUpdates(initialUpdates);
	}, [initialUpdates]);

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
			<div className="space-y-4">
				<EmptyStateBlock
					title="No updates posted"
					description="Organization announcements will appear here when managers post them."
					variant="card"
				/>
				{canManage ? (
					<div className="flex justify-start">
						<CreateUpdatePostDialog
							organizationId={organizationId}
							onCreated={(update) => {
								setUpdates((current) => sortUpdates([update, ...current]));
							}}
						>
							<Button size="sm">Post an update</Button>
						</CreateUpdatePostDialog>
					</div>
				) : null}
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{canManage ? (
				<div className="flex justify-start">
					<CreateUpdatePostDialog
						organizationId={organizationId}
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
								<>
									<EditUpdatePostDialog
										post={post}
										onUpdated={(updated) =>
											setUpdates((current) =>
												sortUpdates(current.map((u) => (u.id === updated.id ? updated : u)))
											)
										}
									>
										<Button type="button" size="sm" variant="outline">
											Edit
										</Button>
									</EditUpdatePostDialog>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => handleDelete(post.id)}
										disabled={!!deletingUpdateId}
									>
										Delete
									</Button>
								</>
							) : undefined
						}
					/>
				))}
			</div>
		</div>
	);
}
