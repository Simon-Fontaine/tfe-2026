"use client";

import type { ReportStatus } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { moderationCaseAction } from "@/app/actions/moderation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CaseActionsProps {
	reportId: string;
	currentStatus: ReportStatus;
	assignedModeratorId: string | null;
	currentUserId: string;
}

export function CaseActions({
	reportId,
	currentStatus,
	assignedModeratorId,
	currentUserId,
}: CaseActionsProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	const [noteContent, setNoteContent] = useState("");
	const [showNoteForm, setShowNoteForm] = useState(false);

	const [showResolveForm, setShowResolveForm] = useState(false);
	const [resolveReason, setResolveReason] = useState("");

	const [showDismissForm, setShowDismissForm] = useState(false);
	const [dismissReason, setDismissReason] = useState("");

	const isSettled = currentStatus === "resolved" || currentStatus === "dismissed";
	const isAssignedToMe = assignedModeratorId === currentUserId;
	const isUnassigned = !assignedModeratorId;

	// P6: onSuccess runs only after the action resolves successfully so form content
	// is never discarded before we know the outcome
	async function runAction(payload: Record<string, unknown>, onSuccess?: () => void) {
		setError(null);
		startTransition(async () => {
			const result = await moderationCaseAction(reportId, payload);
			if (result.error) {
				setError(result.error);
			} else {
				onSuccess?.();
				router.refresh();
			}
		});
	}

	return (
		<div className="space-y-4 rounded-lg border p-4">
			<h3 className="text-sm font-semibold">Case Actions</h3>

			{error && <p className="text-sm text-destructive">{error}</p>}

			<div className="flex flex-wrap gap-2">
				{isUnassigned && (
					<Button
						size="sm"
						variant="outline"
						disabled={isPending}
						onClick={() => runAction({ action: "assign" })}
					>
						Assign to me
					</Button>
				)}
				{isAssignedToMe && (
					<Button
						size="sm"
						variant="outline"
						disabled={isPending}
						onClick={() => runAction({ action: "unassign" })}
					>
						Unassign
					</Button>
				)}
				{!showNoteForm && (
					<Button
						size="sm"
						variant="outline"
						disabled={isPending}
						onClick={() => setShowNoteForm(true)}
					>
						Add Note
					</Button>
				)}
				{!isSettled && !showResolveForm && (
					<Button
						size="sm"
						variant="outline"
						disabled={isPending}
						onClick={() => setShowResolveForm(true)}
					>
						Resolve
					</Button>
				)}
				{!isSettled && !showDismissForm && (
					<Button
						size="sm"
						variant="outline"
						disabled={isPending}
						onClick={() => setShowDismissForm(true)}
					>
						Dismiss
					</Button>
				)}
			</div>

			{showNoteForm && (
				<div className="space-y-2">
					<Textarea
						placeholder="Add a moderator note (5–2000 characters)…"
						value={noteContent}
						onChange={(e) => setNoteContent(e.target.value)}
						minLength={5}
						maxLength={2000}
						rows={3}
					/>
					<div className="flex gap-2">
						<Button
							size="sm"
							disabled={isPending || noteContent.trim().length < 5}
							onClick={() =>
								runAction({ action: "note", content: noteContent }, () => {
									setNoteContent("");
									setShowNoteForm(false);
								})
							}
						>
							Submit Note
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => {
								setShowNoteForm(false);
								setNoteContent("");
							}}
						>
							Cancel
						</Button>
					</div>
				</div>
			)}

			{showResolveForm && (
				<div className="space-y-2">
					<Textarea
						placeholder="Resolution reason (10–2000 characters)…"
						value={resolveReason}
						onChange={(e) => setResolveReason(e.target.value)}
						minLength={10}
						maxLength={2000}
						rows={3}
					/>
					<div className="flex gap-2">
						<Button
							size="sm"
							disabled={isPending || resolveReason.trim().length < 10}
							onClick={() =>
								runAction({ action: "resolve", reason: resolveReason }, () => {
									setResolveReason("");
									setShowResolveForm(false);
								})
							}
						>
							Confirm Resolve
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => {
								setShowResolveForm(false);
								setResolveReason("");
							}}
						>
							Cancel
						</Button>
					</div>
				</div>
			)}

			{showDismissForm && (
				<div className="space-y-2">
					<Textarea
						placeholder="Dismissal reason (10–2000 characters)…"
						value={dismissReason}
						onChange={(e) => setDismissReason(e.target.value)}
						minLength={10}
						maxLength={2000}
						rows={3}
					/>
					<div className="flex gap-2">
						<Button
							size="sm"
							variant="destructive"
							disabled={isPending || dismissReason.trim().length < 10}
							onClick={() =>
								runAction({ action: "dismiss", reason: dismissReason }, () => {
									setDismissReason("");
									setShowDismissForm(false);
								})
							}
						>
							Confirm Dismiss
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => {
								setShowDismissForm(false);
								setDismissReason("");
							}}
						>
							Cancel
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
