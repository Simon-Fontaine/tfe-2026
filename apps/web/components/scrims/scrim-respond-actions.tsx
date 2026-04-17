"use client";

import type { ScrimDetail } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { apiRoutes } from "@/lib/routes";
import { readApiPayload } from "./form-errors";

interface ScrimRespondActionsProps {
	scrimId: string;
	teamId: string;
	scrimStatus: ScrimDetail["status"];
	awayTeamId: string | null;
	scheduledAt: string | null;
	canManage: boolean;
}

function toDateTimeLocal(value: string | null) {
	if (!value) return "";

	const date = new Date(value);
	const pad = (part: number) => String(part).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
		date.getHours()
	)}:${pad(date.getMinutes())}`;
}

function toIsoTimestamp(value: string) {
	if (!value) return undefined;

	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function ScrimRespondActions({
	scrimId,
	teamId,
	scrimStatus,
	awayTeamId,
	scheduledAt,
	canManage,
}: ScrimRespondActionsProps) {
	const router = useRouter();
	const [acceptOpen, setAcceptOpen] = useState(false);
	const [cancelOpen, setCancelOpen] = useState(false);
	const [acceptScheduledAt, setAcceptScheduledAt] = useState(toDateTimeLocal(scheduledAt));
	const [acceptError, setAcceptError] = useState<string | undefined>(undefined);
	const [pendingAction, setPendingAction] = useState<"accept" | "cancel" | null>(null);

	const isAwayTeamContext = awayTeamId === teamId;
	const canAccept = canManage && isAwayTeamContext && scrimStatus === "pending";
	const canCancel = canManage && scrimStatus !== "cancelled" && scrimStatus !== "completed";

	if (!canAccept && !canCancel) return null;

	async function submitAction(action: "accept" | "cancel") {
		setPendingAction(action);
		if (action === "accept") setAcceptError(undefined);

		try {
			const response = await fetch(apiRoutes.scrims.respond(scrimId), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					action,
					scheduledAt: action === "accept" ? toIsoTimestamp(acceptScheduledAt) : undefined,
				}),
			});
			const payload = await readApiPayload<ScrimDetail>(response);

			if (!response.ok) {
				if (action === "accept") {
					setAcceptError(payload.error ?? "Unable to update this scrim.");
				} else {
					toast.error(payload.error ?? "Unable to cancel this scrim.");
				}
				return;
			}

			toast.success(action === "accept" ? "Scrim accepted." : "Scrim cancelled.");
			setAcceptOpen(false);
			setCancelOpen(false);
			startTransition(() => {
				router.refresh();
			});
		} catch {
			if (action === "accept") {
				setAcceptError("Unable to reach the API server.");
			} else {
				toast.error("Unable to reach the API server.");
			}
		} finally {
			setPendingAction(null);
		}
	}

	return (
		<div className="flex flex-wrap gap-2">
			{canAccept ? (
				<Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
					<DialogTrigger asChild>
						<Button size="sm">Accept request</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-md">
						<DialogHeader>
							<DialogTitle>Accept scrim request</DialogTitle>
							<DialogDescription>
								Confirm the matchup from the invited team side. You can optionally lock in the final
								start time here.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4">
							<Field>
								<FieldLabel>Start time</FieldLabel>
								<Input
									type="datetime-local"
									value={acceptScheduledAt}
									onChange={(event) => {
										setAcceptScheduledAt(event.target.value);
										setAcceptError(undefined);
									}}
									disabled={pendingAction !== null}
								/>
								<FieldDescription>
									Leave this blank to keep the original proposed time.
								</FieldDescription>
							</Field>

							{acceptError ? <p className="text-xs text-destructive">{acceptError}</p> : null}

							<div className="flex gap-2">
								<Button
									type="button"
									size="sm"
									onClick={() => void submitAction("accept")}
									disabled={pendingAction !== null}
								>
									{pendingAction === "accept" && <Spinner className="mr-1.5" />}
									Accept scrim
								</Button>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => setAcceptOpen(false)}
									disabled={pendingAction !== null}
								>
									Cancel
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			) : null}

			{canCancel ? (
				<AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
					<AlertDialogTrigger asChild>
						<Button size="sm" variant="outline">
							Cancel scrim
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Cancel this scrim?</AlertDialogTitle>
							<AlertDialogDescription>
								This will mark the matchup as cancelled for both teams. Result reporting and
								confirmation stop here.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={pendingAction !== null}>Back</AlertDialogCancel>
							<Button
								size="sm"
								variant="destructive"
								onClick={() => void submitAction("cancel")}
								disabled={pendingAction !== null}
							>
								{pendingAction === "cancel" && <Spinner className="mr-1.5" />}
								Cancel scrim
							</Button>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			) : null}
		</div>
	);
}
