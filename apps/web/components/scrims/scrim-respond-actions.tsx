"use client";

import type { ScrimDetail } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
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
import { toDateTimeLocal, toIsoTimestamp } from "@/lib/scrims/format";
import { readApiPayload } from "./form-errors";

interface ScrimRespondActionsProps {
	scrimId: string;
	teamId: string;
	scrimStatus: ScrimDetail["status"];
	awayTeamId: string | null;
	scheduledAt: string | null;
	canManage: boolean;
}

type RespondAction = "accept" | "cancel" | "decline" | "reschedule" | "propose_changes" | "start";

interface ExtraFields {
	scheduledAt?: string;
	config?: { bestOf?: number; format?: string };
	message?: string;
	cancelReason?: string;
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
	const [declineOpen, setDeclineOpen] = useState(false);
	const [rescheduleOpen, setRescheduleOpen] = useState(false);
	const [proposeOpen, setProposeOpen] = useState(false);
	const [startOpen, setStartOpen] = useState(false);

	const [acceptScheduledAt, setAcceptScheduledAt] = useState(toDateTimeLocal(scheduledAt));
	const [rescheduleScheduledAt, setRescheduleScheduledAt] = useState(toDateTimeLocal(scheduledAt));
	const [proposeBestOf, setProposeBestOf] = useState("");
	const [proposeFormat, setProposeFormat] = useState("");
	const [proposeScheduledAt, setProposeScheduledAt] = useState(toDateTimeLocal(scheduledAt));
	const [proposeMessage, setProposeMessage] = useState("");
	const [cancelReason, setCancelReason] = useState("");

	const [acceptError, setAcceptError] = useState<string | undefined>(undefined);
	const [rescheduleError, setRescheduleError] = useState<string | undefined>(undefined);
	const [proposeError, setProposeError] = useState<string | undefined>(undefined);

	const [pendingAction, setPendingAction] = useState<RespondAction | null>(null);

	useEffect(() => {
		setAcceptScheduledAt(toDateTimeLocal(scheduledAt));
		setRescheduleScheduledAt(toDateTimeLocal(scheduledAt));
		setProposeScheduledAt(toDateTimeLocal(scheduledAt));
	}, [scheduledAt]);

	const isAwayTeamContext = awayTeamId === teamId;
	const canAccept = canManage && isAwayTeamContext && scrimStatus === "pending";
	const canDecline = canManage && isAwayTeamContext && scrimStatus === "pending";
	const canProposeChanges = canManage && isAwayTeamContext && scrimStatus === "pending";
	const canReschedule = canManage && (scrimStatus === "accepted" || scrimStatus === "scheduled");
	const canStart =
		canManage && (scrimStatus === "accepted" || scrimStatus === "scheduled") && !!awayTeamId;
	const canCancel =
		canManage &&
		scrimStatus !== "in_progress" &&
		scrimStatus !== "cancelled" &&
		scrimStatus !== "completed" &&
		scrimStatus !== "awaiting_confirmation" &&
		scrimStatus !== "disputed";

	if (
		!canAccept &&
		!canDecline &&
		!canProposeChanges &&
		!canReschedule &&
		!canStart &&
		!canCancel
	) {
		return null;
	}

	async function submitAction(action: RespondAction, extra?: ExtraFields) {
		setPendingAction(action);
		if (action === "accept") setAcceptError(undefined);
		if (action === "reschedule") setRescheduleError(undefined);
		if (action === "propose_changes") setProposeError(undefined);

		try {
			const response = await fetch(apiRoutes.scrims.respond(scrimId), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					action,
					scheduledAt:
						action === "accept"
							? toIsoTimestamp(acceptScheduledAt)
							: action === "reschedule"
								? toIsoTimestamp(rescheduleScheduledAt)
								: extra?.scheduledAt,
					config: extra?.config,
					message: extra?.message,
					cancelReason: extra?.cancelReason,
				}),
			});
			const payload = await readApiPayload<ScrimDetail>(response);

			if (!response.ok) {
				const errorMsg = payload.error ?? "Unable to update this scrim.";
				if (action === "accept") {
					setAcceptError(errorMsg);
				} else if (action === "reschedule") {
					setRescheduleError(errorMsg);
				} else if (action === "propose_changes") {
					setProposeError(errorMsg);
				} else {
					toast.error(errorMsg);
				}
				return;
			}

			const successMessages: Record<RespondAction, string> = {
				accept: "Scrim accepted.",
				cancel: "Scrim cancelled.",
				decline: "Scrim request declined.",
				reschedule: "Reschedule proposed.",
				propose_changes: "Updated terms proposed.",
				start: "Scrim marked as in progress.",
			};
			toast.success(successMessages[action]);

			setAcceptOpen(false);
			setCancelOpen(false);
			setDeclineOpen(false);
			setRescheduleOpen(false);
			setProposeOpen(false);
			setStartOpen(false);

			startTransition(() => {
				router.refresh();
			});
		} catch {
			const errorMsg = "Unable to reach the API server.";
			if (action === "accept") {
				setAcceptError(errorMsg);
			} else if (action === "reschedule") {
				setRescheduleError(errorMsg);
			} else if (action === "propose_changes") {
				setProposeError(errorMsg);
			} else {
				toast.error(errorMsg);
			}
		} finally {
			setPendingAction(null);
		}
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
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

			{canDecline ? (
				<AlertDialog open={declineOpen} onOpenChange={setDeclineOpen}>
					<AlertDialogTrigger asChild>
						<Button size="sm" variant="outline">
							Decline request
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Decline this scrim request?</AlertDialogTitle>
							<AlertDialogDescription>
								This will mark the request as declined for both teams.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={pendingAction !== null}>Back</AlertDialogCancel>
							<Button
								size="sm"
								variant="destructive"
								onClick={() => void submitAction("decline")}
								disabled={pendingAction !== null}
							>
								{pendingAction === "decline" && <Spinner className="mr-1.5" />}
								Decline
							</Button>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			) : null}

			{canProposeChanges ? (
				<Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
					<DialogTrigger asChild>
						<Button size="sm" variant="outline">
							Propose changes
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-md">
						<DialogHeader>
							<DialogTitle>Propose new terms</DialogTitle>
							<DialogDescription>
								Suggest updated schedule or format. The home team will be notified.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4">
							<Field>
								<FieldLabel>Proposed start time</FieldLabel>
								<Input
									type="datetime-local"
									value={proposeScheduledAt}
									onChange={(e) => {
										setProposeScheduledAt(e.target.value);
										setProposeError(undefined);
									}}
									disabled={pendingAction !== null}
								/>
								<FieldDescription>Leave blank to keep the current proposed time.</FieldDescription>
							</Field>
							<Field>
								<FieldLabel>Best of</FieldLabel>
								<Input
									type="number"
									min={1}
									max={9}
									placeholder="e.g. 3"
									value={proposeBestOf}
									onChange={(e) => {
										setProposeBestOf(e.target.value);
										setProposeError(undefined);
									}}
									disabled={pendingAction !== null}
								/>
								<FieldDescription>
									Leave blank to keep the current best-of setting.
								</FieldDescription>
							</Field>
							<Field>
								<FieldLabel>Format</FieldLabel>
								<Input
									placeholder="e.g. No Sombra"
									value={proposeFormat}
									onChange={(e) => {
										setProposeFormat(e.target.value);
										setProposeError(undefined);
									}}
									disabled={pendingAction !== null}
								/>
								<FieldDescription>Leave blank to keep the current format.</FieldDescription>
							</Field>
							<Field>
								<FieldLabel>Message</FieldLabel>
								<Input
									placeholder="Optional note for the home team"
									value={proposeMessage}
									onChange={(e) => {
										setProposeMessage(e.target.value);
										setProposeError(undefined);
									}}
									disabled={pendingAction !== null}
								/>
							</Field>

							{proposeError ? <p className="text-xs text-destructive">{proposeError}</p> : null}

							<div className="flex gap-2">
								<Button
									type="button"
									size="sm"
									onClick={() => {
										const bestOfNum = proposeBestOf
											? Number.parseInt(proposeBestOf, 10)
											: undefined;
										void submitAction("propose_changes", {
											scheduledAt: proposeScheduledAt
												? toIsoTimestamp(proposeScheduledAt)
												: undefined,
											config:
												bestOfNum !== undefined || proposeFormat
													? {
															bestOf: bestOfNum,
															format: proposeFormat || undefined,
														}
													: undefined,
											message: proposeMessage || undefined,
										});
									}}
									disabled={pendingAction !== null}
								>
									{pendingAction === "propose_changes" && <Spinner className="mr-1.5" />}
									Send proposal
								</Button>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => setProposeOpen(false)}
									disabled={pendingAction !== null}
								>
									Cancel
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			) : null}

			{canReschedule ? (
				<Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
					<DialogTrigger asChild>
						<Button size="sm" variant="outline">
							Propose reschedule
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-md">
						<DialogHeader>
							<DialogTitle>Propose a new time</DialogTitle>
							<DialogDescription>
								Both teams will see the updated schedule. The other team will be notified.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4">
							<Field>
								<FieldLabel>New start time</FieldLabel>
								<Input
									type="datetime-local"
									value={rescheduleScheduledAt}
									onChange={(e) => {
										setRescheduleScheduledAt(e.target.value);
										setRescheduleError(undefined);
									}}
									disabled={pendingAction !== null}
								/>
							</Field>

							{rescheduleError ? (
								<p className="text-xs text-destructive">{rescheduleError}</p>
							) : null}

							<div className="flex gap-2">
								<Button
									type="button"
									size="sm"
									onClick={() => void submitAction("reschedule")}
									disabled={pendingAction !== null}
								>
									{pendingAction === "reschedule" && <Spinner className="mr-1.5" />}
									Confirm reschedule
								</Button>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => setRescheduleOpen(false)}
									disabled={pendingAction !== null}
								>
									Cancel
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			) : null}

			{canStart ? (
				<AlertDialog open={startOpen} onOpenChange={setStartOpen}>
					<AlertDialogTrigger asChild>
						<Button size="sm">Start scrim</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Mark scrim as in progress?</AlertDialogTitle>
							<AlertDialogDescription>
								Both teams will see the scrim as in progress. Either team manager can still report
								results when done.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={pendingAction !== null}>Cancel</AlertDialogCancel>
							<Button
								size="sm"
								onClick={() => void submitAction("start")}
								disabled={pendingAction !== null}
							>
								{pendingAction === "start" && <Spinner className="mr-1.5" />}
								Start
							</Button>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			) : null}

			{canCancel ? (
				<AlertDialog
					open={cancelOpen}
					onOpenChange={(open) => {
						setCancelOpen(open);
						if (!open) setCancelReason("");
					}}
				>
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
						<div className="px-1 pb-2">
							<Field>
								<FieldLabel>Reason (optional)</FieldLabel>
								<Input
									placeholder="Brief reason for both teams"
									value={cancelReason}
									onChange={(e) => setCancelReason(e.target.value)}
									disabled={pendingAction !== null}
									maxLength={500}
								/>
								<FieldDescription>
									Visible to both teams in the negotiation history.
								</FieldDescription>
							</Field>
						</div>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={pendingAction !== null}>Back</AlertDialogCancel>
							<Button
								size="sm"
								variant="destructive"
								onClick={() =>
									void submitAction("cancel", { cancelReason: cancelReason || undefined })
								}
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
