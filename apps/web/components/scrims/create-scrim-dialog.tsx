"use client";

import type { DiscoveryTeam, ScrimDetail } from "@scrimflow/shared";
import { apiRoutes, appRoutes } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { type FormFieldErrors, getFieldErrorText, readApiPayload } from "./form-errors";

interface CreateScrimDialogProps {
	children: React.ReactNode;
	teamId: string;
	opponentOptions: DiscoveryTeam[];
}

function toIsoTimestamp(value: string) {
	if (!value) return undefined;

	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function CreateScrimDialog({ children, teamId, opponentOptions }: CreateScrimDialogProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [awayTeamId, setAwayTeamId] = useState(opponentOptions[0]?.id ?? "");
	const [scheduledAt, setScheduledAt] = useState("");
	const [bestOf, setBestOf] = useState("5");
	const [format, setFormat] = useState("Best of 5");
	const [message, setMessage] = useState("");
	const [formError, setFormError] = useState<string | undefined>(undefined);
	const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
	const [submitting, setSubmitting] = useState(false);

	const selectClassName = useMemo(
		() =>
			cn(
				"flex h-8 w-full rounded-none border border-input bg-background px-3 text-xs outline-none",
				"focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
			),
		[]
	);

	function resetState() {
		setAwayTeamId(opponentOptions[0]?.id ?? "");
		setScheduledAt("");
		setBestOf("5");
		setFormat("Best of 5");
		setMessage("");
		setFormError(undefined);
		setFieldErrors({});
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		const nextFieldErrors: FormFieldErrors = {};
		if (!awayTeamId) {
			nextFieldErrors.awayTeamId = ["Select an opponent team."];
		}

		const bestOfValue = bestOf.trim();
		if (bestOfValue) {
			const parsedBestOf = Number(bestOfValue);
			if (!Number.isInteger(parsedBestOf) || parsedBestOf < 1 || parsedBestOf > 9) {
				nextFieldErrors.bestOf = ["Best of must be a whole number between 1 and 9."];
			}
		}

		if (Object.keys(nextFieldErrors).length > 0) {
			setFieldErrors(nextFieldErrors);
			setFormError(undefined);
			return;
		}

		setSubmitting(true);
		setFormError(undefined);
		setFieldErrors({});

		try {
			const config: Record<string, unknown> = {};
			if (bestOfValue) config.bestOf = Number(bestOfValue);
			if (format.trim()) config.format = format.trim();

			const response = await fetch(apiRoutes.scrims.root, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					homeTeamId: teamId,
					awayTeamId,
					scheduledAt: toIsoTimestamp(scheduledAt),
					message: message.trim() || undefined,
					config: Object.keys(config).length > 0 ? config : undefined,
				}),
			});
			const payload = await readApiPayload<ScrimDetail>(response);

			if (!response.ok || !payload.data) {
				setFieldErrors(payload.fieldErrors ?? {});
				setFormError(payload.error ?? "Unable to create scrim request.");
				return;
			}
			const createdScrim = payload.data;

			toast.success("Scrim request created.");
			resetState();
			setOpen(false);
			startTransition(() => {
				router.push(appRoutes.teams.scrimById(teamId, createdScrim.id));
			});
		} catch {
			setFormError("Unable to reach the API server.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				if (!nextOpen) resetState();
			}}
		>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>New scrim request</DialogTitle>
					<DialogDescription>
						Send a direct scrim request to another team. Set your preferred schedule, format, and
						any notes for the team manager.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<Field>
						<FieldLabel>Opponent team</FieldLabel>
						<select
							value={awayTeamId}
							onChange={(event) => {
								setAwayTeamId(event.target.value);
								setFieldErrors((current) => ({ ...current, awayTeamId: undefined }));
								setFormError(undefined);
							}}
							className={selectClassName}
							disabled={submitting}
						>
							<option value="">Select a team</option>
							{opponentOptions.map((team) => (
								<option key={team.id} value={team.id}>
									[{team.tag}] {team.name}
									{Number.isFinite(team.rating) ? ` · Rating ${team.rating}` : ""}
								</option>
							))}
						</select>
						<FieldDescription>Choose the team you want to scrim against.</FieldDescription>
						<FieldError>{getFieldErrorText(fieldErrors, "awayTeamId")}</FieldError>
					</Field>

					<div className="grid gap-4 sm:grid-cols-2">
						<Field>
							<FieldLabel>Preferred start</FieldLabel>
							<Input
								type="datetime-local"
								value={scheduledAt}
								onChange={(event) => {
									setScheduledAt(event.target.value);
									setFormError(undefined);
								}}
								disabled={submitting}
							/>
							<FieldDescription>
								Optional. The invited team can accept with this time. Check your{" "}
								<a
									href={appRoutes.teams.calendar(teamId)}
									target="_blank"
									rel="noopener noreferrer"
									className="underline underline-offset-2"
								>
									team calendar
								</a>{" "}
								before proposing a time.
							</FieldDescription>
						</Field>

						<Field>
							<FieldLabel>Best of</FieldLabel>
							<Input
								type="number"
								min={1}
								max={9}
								step={1}
								value={bestOf}
								onChange={(event) => {
									setBestOf(event.target.value);
									setFieldErrors((current) => ({ ...current, bestOf: undefined }));
									setFormError(undefined);
								}}
								disabled={submitting}
							/>
							<FieldError>{getFieldErrorText(fieldErrors, "bestOf")}</FieldError>
						</Field>
					</div>

					<Field>
						<FieldLabel>Format label</FieldLabel>
						<Input
							value={format}
							onChange={(event) => {
								setFormat(event.target.value);
								setFormError(undefined);
							}}
							placeholder="Best of 5"
							maxLength={60}
							disabled={submitting}
						/>
					</Field>

					<Field>
						<FieldLabel>Manager note</FieldLabel>
						<Textarea
							value={message}
							onChange={(event) => {
								setMessage(event.target.value);
								setFormError(undefined);
							}}
							rows={5}
							maxLength={1000}
							placeholder="Map pool preferences, availability notes, or lobby instructions."
							disabled={submitting}
						/>
						<FieldError>{getFieldErrorText(fieldErrors, "message")}</FieldError>
					</Field>

					{formError ? <p className="text-xs text-destructive">{formError}</p> : null}

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={submitting || opponentOptions.length === 0}>
							{submitting && <Spinner className="mr-1.5" />}
							Create request
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => {
								resetState();
								setOpen(false);
							}}
							disabled={submitting}
						>
							Cancel
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
