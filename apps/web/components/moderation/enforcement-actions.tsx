"use client";

import type { ModerationAction, ModerationActionType, ReportTargetType } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createModerationAction, reverseModerationAction } from "@/app/actions/moderation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import { cn } from "@/lib/utils";

const ACTION_TYPE_LABELS: Record<ModerationActionType, string> = {
	warn: "Warn",
	suspend: "Suspend",
	restore: "Restore",
	hide: "Hide",
	unhide: "Unhide",
	remove: "Remove",
	require_verification: "Require Verification",
	clear_verification: "Clear Verification",
	escalate: "Escalate",
};

const ACTION_TYPES: ModerationActionType[] = [
	"warn",
	"suspend",
	"restore",
	"hide",
	"unhide",
	"remove",
	"require_verification",
	"clear_verification",
	"escalate",
];

interface EnforcementActionsProps {
	reportId: string;
	targetType: ReportTargetType;
	targetId: string;
	activeActions: ModerationAction[];
}

export function EnforcementActions({
	reportId,
	targetType,
	targetId,
	activeActions,
}: EnforcementActionsProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	const [actionType, setActionType] = useState<ModerationActionType>("warn");
	const [reason, setReason] = useState("");
	const [durationHours, setDurationHours] = useState("");

	async function handleSubmit() {
		setError(null);
		const parsed = durationHours ? Number.parseInt(durationHours, 10) : undefined;

		startTransition(async () => {
			const result = await createModerationAction({
				targetType,
				targetId,
				actionType,
				reason,
				caseId: reportId,
				...(parsed && parsed > 0 ? { durationHours: parsed } : {}),
			});
			if (result.error) {
				setError(result.error);
			} else {
				setReason("");
				setDurationHours("");
				router.refresh();
			}
		});
	}

	async function handleReverse(actionId: string) {
		setError(null);
		startTransition(async () => {
			const result = await reverseModerationAction(actionId);
			if (result.error) {
				setError(result.error);
			} else {
				router.refresh();
			}
		});
	}

	return (
		<div className="space-y-4 rounded-lg border p-4">
			<h3 className="text-sm font-semibold">Enforcement Actions</h3>

			{error && <p className="text-sm text-destructive">{error}</p>}

			{activeActions.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No enforcement actions have been taken against this target.
				</p>
			) : (
				<ul className="space-y-2">
					{activeActions.map((action) => (
						<li key={action.id} className="rounded-md border p-3 text-sm">
							<div className="flex items-start justify-between gap-2">
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<span className="font-medium capitalize">
											{ACTION_TYPE_LABELS[action.actionType]}
										</span>
										{!action.isReversible && (
											<Badge
												variant="outline"
												className={cn("text-xs", STATUS_BADGE_CLASSES.irreversible)}
											>
												Irreversible
											</Badge>
										)}
									</div>
									<p className="text-muted-foreground line-clamp-2">{action.reason}</p>
									<p className="text-xs text-muted-foreground">
										{new Date(action.createdAt).toLocaleString()}
										{action.expiresAt &&
											` · Expires ${new Date(action.expiresAt).toLocaleString()}`}
									</p>
								</div>
								{action.isReversible && !action.reversedAt && (
									<Button
										size="sm"
										variant="outline"
										disabled={isPending}
										onClick={() => handleReverse(action.id)}
										className="shrink-0"
									>
										Reverse
									</Button>
								)}
							</div>
						</li>
					))}
				</ul>
			)}

			<div className="space-y-3 border-t pt-4">
				<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
					New Action
				</p>
				<div className="space-y-2">
					<Select
						value={actionType}
						onValueChange={(v) => setActionType(v as ModerationActionType)}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ACTION_TYPES.map((t) => (
								<SelectItem key={t} value={t}>
									{ACTION_TYPE_LABELS[t]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Textarea
						placeholder="Reason (10–2000 characters)…"
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						minLength={10}
						maxLength={2000}
						rows={3}
					/>
					<Input
						type="number"
						placeholder="Duration (hours, optional)"
						min={1}
						step={1}
						value={durationHours}
						onChange={(e) => setDurationHours(e.target.value)}
					/>
					<Button
						size="sm"
						disabled={isPending || reason.trim().length < 10}
						onClick={handleSubmit}
					>
						Apply Action
					</Button>
				</div>
			</div>
		</div>
	);
}
