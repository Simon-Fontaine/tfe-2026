"use client";

import {
	OCR_MAP_TYPE_VALUES,
	OCR_MAX_MAP_SCORE,
	type OcrGameHistoryMatch,
	type ScrimDetail,
} from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { startTransition, useRef, useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { apiRoutes } from "@/lib/routes";
import { toDateTimeLocal, toIsoTimestamp } from "@/lib/scrims/format";
import { isReviewableJob } from "@/lib/scrims/ocr-status";
import { type FormFieldErrors, getFieldErrorText, readApiPayload } from "./form-errors";

type MapDraft = {
	draftKey: string;
	mapName: string;
	mapType: (typeof OCR_MAP_TYPE_VALUES)[number];
	homeScore: string;
	awayScore: string;
	durationSeconds: string;
};

type ReportScrimResultDialogProps = {
	children: React.ReactNode;
	scrim: ScrimDetail;
	reportingTeamId: string;
};

type ResultSubmissionPayload = {
	reportingTeamId: string;
	homeMapScore: number;
	awayMapScore: number;
	startedAt?: string;
	endedAt?: string;
	sourceOcrJobId?: string;
	maps?: Array<{
		mapName: string;
		mapType: MapDraft["mapType"];
		homeScore: number;
		awayScore: number;
		durationSeconds: number | null;
	}>;
};

function nullableNumberToField(value: number | null) {
	return value === null ? "" : String(value);
}

function createEmptyMapDraft(): MapDraft {
	return {
		draftKey: `manual-${crypto.randomUUID()}`,
		mapName: "",
		mapType: "unknown",
		homeScore: "0",
		awayScore: "0",
		durationSeconds: "",
	};
}

function durationTextToSecondsField(value: string | null) {
	if (!value) return "";

	const [minutesPart, secondsPart] = value.split(":");
	const minutes = Number(minutesPart);
	const seconds = Number(secondsPart);
	if (
		!Number.isInteger(minutes) ||
		!Number.isInteger(seconds) ||
		minutes < 0 ||
		seconds < 0 ||
		seconds >= 60
	) {
		return "";
	}

	return String(minutes * 60 + seconds);
}

function mapOcrMatchToDraft(match: OcrGameHistoryMatch): MapDraft {
	return {
		draftKey: `ocr-${match.matchOrder}-${match.mapName}-${match.allyScore}-${match.enemyScore}`,
		mapName: match.mapName,
		mapType: match.mapType ?? "unknown",
		homeScore: String(match.allyScore),
		awayScore: String(match.enemyScore),
		durationSeconds: durationTextToSecondsField(match.durationText),
	};
}

function mapSavedMapToDraft(map: ScrimDetail["maps"][number]): MapDraft {
	return {
		draftKey: `saved-${map.id}`,
		mapName: map.mapName,
		mapType: map.mapType,
		homeScore: String(map.homeScore),
		awayScore: String(map.awayScore),
		durationSeconds: nullableNumberToField(map.durationSeconds),
	};
}

function deriveSeriesScoreFromDraftMaps(maps: MapDraft[]) {
	return maps.reduce(
		(score, map) => {
			const homeScore = Number(map.homeScore);
			const awayScore = Number(map.awayScore);
			if (Number.isFinite(homeScore) && Number.isFinite(awayScore)) {
				if (homeScore > awayScore) score.homeMapScore += 1;
				else if (awayScore > homeScore) score.awayMapScore += 1;
			}
			return score;
		},
		{ homeMapScore: 0, awayMapScore: 0 }
	);
}

function getInitialState(scrim: ScrimDetail) {
	return {
		manualHomeMapScore: String(scrim.homeMapScore),
		manualAwayMapScore: String(scrim.awayMapScore),
		startedAt: toDateTimeLocal(scrim.startedAt),
		endedAt: toDateTimeLocal(scrim.endedAt),
		sourceOcrJobId: scrim.maps.find((map) => map.ocrJobId)?.ocrJobId ?? null,
		maps: scrim.maps.map(mapSavedMapToDraft),
	};
}

function formatJobLabel(job: ScrimDetail["ocrJobs"][number]) {
	return `${job.screenshotType.replace("_", " ")} • ${new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(job.createdAt))}`;
}

function parseOptionalInteger(value: string, label: string) {
	if (!value.trim()) return null;
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 0) {
		throw new Error(`${label} must be a whole number or left empty.`);
	}
	return parsed;
}

function parseRequiredScore(value: string, label: string) {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9) {
		throw new Error(`${label} must be a whole number between 0 and 9.`);
	}
	return parsed;
}

function parseRoundScore(value: string, label: string) {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 0 || parsed > OCR_MAX_MAP_SCORE) {
		throw new Error(`${label} must be a whole number between 0 and ${OCR_MAX_MAP_SCORE}.`);
	}
	return parsed;
}

function deriveMapResult(homeScore: string, awayScore: string) {
	const parsedHomeScore = Number(homeScore);
	const parsedAwayScore = Number(awayScore);
	if (!Number.isFinite(parsedHomeScore) || !Number.isFinite(parsedAwayScore)) return "invalid";
	if (parsedHomeScore > parsedAwayScore) return "home win";
	if (parsedAwayScore > parsedHomeScore) return "away win";
	return "draw";
}

export function ReportScrimResultDialog({
	children,
	scrim,
	reportingTeamId,
}: ReportScrimResultDialogProps) {
	const router = useRouter();
	// Both `completed` and `requires_review` game-history jobs carry
	// `validatedOutput` and are valid map-list drafts to load here.
	const reviewableJobs = scrim.ocrJobs.filter(
		(job) => isReviewableJob(job) && job.validatedOutput?.screenshotType === "game_history"
	);
	const initialState = getInitialState(scrim);
	const [open, setOpen] = useState(false);
	const [manualHomeMapScore, setManualHomeMapScore] = useState(initialState.manualHomeMapScore);
	const [manualAwayMapScore, setManualAwayMapScore] = useState(initialState.manualAwayMapScore);
	const [localStartedAt, setLocalStartedAt] = useState(initialState.startedAt);
	const [localEndedAt, setLocalEndedAt] = useState(initialState.endedAt);
	const [sourceOcrJobId, setSourceOcrJobId] = useState<string | null>(initialState.sourceOcrJobId);
	const [selectedOcrJobId, setSelectedOcrJobId] = useState(reviewableJobs[0]?.id ?? "");
	const [maps, setMaps] = useState<MapDraft[]>(initialState.maps);
	const [formError, setFormError] = useState<string | undefined>(undefined);
	const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
	const [submitting, setSubmitting] = useState(false);
	const submittingRef = useRef(false);
	const [pendingSubmission, setPendingSubmission] = useState<ResultSubmissionPayload | null>(null);
	const [pendingSubmissionMapCount, setPendingSubmissionMapCount] = useState(0);

	function resetState() {
		const nextState = getInitialState(scrim);
		setManualHomeMapScore(nextState.manualHomeMapScore);
		setManualAwayMapScore(nextState.manualAwayMapScore);
		setLocalStartedAt(nextState.startedAt);
		setLocalEndedAt(nextState.endedAt);
		setSourceOcrJobId(nextState.sourceOcrJobId);
		setSelectedOcrJobId(reviewableJobs[0]?.id ?? "");
		setMaps(nextState.maps);
		setFormError(undefined);
		setFieldErrors({});
		setPendingSubmission(null);
		setPendingSubmissionMapCount(0);
	}

	function updateMap(mapIndex: number, updater: (current: MapDraft) => MapDraft) {
		setMaps((current) => current.map((map, index) => (index === mapIndex ? updater(map) : map)));
		setFormError(undefined);
	}

	function handleLoadOcrDraft() {
		const selectedJob = reviewableJobs.find((job) => job.id === selectedOcrJobId);
		if (
			!selectedJob?.validatedOutput ||
			selectedJob.validatedOutput.screenshotType !== "game_history"
		) {
			setFormError("Select a completed OCR draft before loading it.");
			return;
		}

		const nextMaps = selectedJob.validatedOutput.matches.map(mapOcrMatchToDraft);
		const derivedSeriesScore = deriveSeriesScoreFromDraftMaps(nextMaps);

		setMaps(nextMaps);
		setManualHomeMapScore(String(derivedSeriesScore.homeMapScore));
		setManualAwayMapScore(String(derivedSeriesScore.awayMapScore));
		setSourceOcrJobId(selectedJob.id);
		setFormError(undefined);
	}

	async function submitResultPackage(payload: ResultSubmissionPayload, mapCount: number) {
		if (submittingRef.current) return;
		submittingRef.current = true;
		setSubmitting(true);
		setFormError(undefined);
		setFieldErrors({});

		try {
			const response = await fetch(apiRoutes.scrims.result(scrim.id), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(payload),
			});
			const responsePayload = await readApiPayload<ScrimDetail>(response);
			if (!response.ok || !responsePayload.data) {
				setFieldErrors(responsePayload.fieldErrors ?? {});
				setFormError(responsePayload.error ?? "Unable to submit scrim results.");
				return;
			}

			toast.success(
				mapCount > 0 ? "Series result submitted for confirmation." : "Series score submitted."
			);
			resetState();
			setOpen(false);
			startTransition(() => router.refresh());
		} catch {
			setFormError("Unable to reach the API server.");
		} finally {
			submittingRef.current = false;
			setSubmitting(false);
			setPendingSubmission(null);
			setPendingSubmissionMapCount(0);
		}
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submittingRef.current) return;
		setFormError(undefined);
		setFieldErrors({});

		try {
			const parsedMaps = maps.map((map, mapIndex) => {
				if (!map.mapName.trim()) throw new Error(`Map ${mapIndex + 1} needs a map name.`);
				return {
					mapName: map.mapName.trim(),
					mapType: map.mapType,
					homeScore: parseRoundScore(map.homeScore, `Map ${mapIndex + 1} home score`),
					awayScore: parseRoundScore(map.awayScore, `Map ${mapIndex + 1} away score`),
					durationSeconds: parseOptionalInteger(
						map.durationSeconds,
						`Map ${mapIndex + 1} duration`
					),
				};
			});

			const resolvedSeriesScore =
				parsedMaps.length > 0
					? deriveSeriesScoreFromDraftMaps(maps)
					: {
							homeMapScore: parseRequiredScore(manualHomeMapScore, "Home map score"),
							awayMapScore: parseRequiredScore(manualAwayMapScore, "Away map score"),
						};

			const payload: ResultSubmissionPayload = {
				reportingTeamId,
				homeMapScore: resolvedSeriesScore.homeMapScore,
				awayMapScore: resolvedSeriesScore.awayMapScore,
				startedAt: toIsoTimestamp(localStartedAt),
				endedAt: toIsoTimestamp(localEndedAt),
				sourceOcrJobId: parsedMaps.length > 0 ? (sourceOcrJobId ?? undefined) : undefined,
				maps: parsedMaps.length > 0 ? parsedMaps : undefined,
			};

			// Score-only reports skip per-map detail entirely, so confirm intent.
			if (parsedMaps.length === 0) {
				setPendingSubmission(payload);
				setPendingSubmissionMapCount(0);
				return;
			}

			await submitResultPackage(payload, parsedMaps.length);
		} catch (error) {
			setFormError(error instanceof Error ? error.message : "Unable to validate the scrim result.");
		}
	}

	const derivedSeriesScore = deriveSeriesScoreFromDraftMaps(maps);
	const loadedOcrJob = sourceOcrJobId
		? reviewableJobs.find((job) => job.id === sourceOcrJobId)
		: null;
	const hadSavedStats = scrim.maps.some((map) => map.players.length > 0);

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				if (!nextOpen) resetState();
			}}
		>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
				<DialogHeader>
					<DialogTitle>Report series result</DialogTitle>
					<DialogDescription>
						Set the maps played and their scores — this is what both teams confirm. Player-stat
						scoreboards are reviewed separately on each map after submitting.
					</DialogDescription>
				</DialogHeader>

				{scrim.status === "completed" ? (
					<div className="bg-muted/40 p-3 text-xs text-muted-foreground">
						<strong>This result is locked.</strong> Both teams have confirmed — the series can no
						longer be replaced through this editor.
					</div>
				) : scrim.maps.length > 0 ||
					scrim.status === "awaiting_confirmation" ||
					scrim.status === "disputed" ? (
					<div className="bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
						<strong>Existing result will be replaced.</strong> Submitting overwrites the current map
						rows and resets both teams&apos; confirmations.
						{hadSavedStats ? " Saved player stats are cleared because the maps are rebuilt." : ""}{" "}
						The previous result is preserved in revision history.
					</div>
				) : null}

				<form onSubmit={handleSubmit} className="space-y-6">
					<div className="grid gap-3 sm:grid-cols-2">
						<Card size="sm">
							<CardContent>
								<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
									Map drafts
								</p>
								<p className="mt-1 text-lg font-semibold">{maps.length}</p>
								<p className="text-xs text-muted-foreground">Saved only after final submit.</p>
							</CardContent>
						</Card>
						<Card size="sm">
							<CardContent>
								<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
									Series score
								</p>
								<p className="mt-1 text-lg font-semibold">
									{maps.length > 0
										? `${derivedSeriesScore.homeMapScore} - ${derivedSeriesScore.awayMapScore}`
										: `${manualHomeMapScore || 0} - ${manualAwayMapScore || 0}`}
								</p>
								<p className="text-xs text-muted-foreground">
									{maps.length > 0 ? "Derived from the map rows." : "Manual score-only entry."}
								</p>
							</CardContent>
						</Card>
					</div>

					<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
						<div className="space-y-4 border p-4">
							<div>
								<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Series result
								</p>
								{maps.length > 0 ? (
									<div className="mt-2 bg-muted/30 p-3 text-sm font-semibold">
										{scrim.homeTeam.name} {derivedSeriesScore.homeMapScore} -{" "}
										{derivedSeriesScore.awayMapScore} {scrim.awayTeam?.name ?? "Opponent"}
										<p className="mt-1 text-xs font-normal text-muted-foreground">
											Derived from the reviewed map rows.
										</p>
									</div>
								) : (
									<div className="mt-2 grid gap-3 sm:grid-cols-2">
										<div>
											<p className="text-xs font-medium">Home map score</p>
											<Input
												aria-label="Home map score"
												type="number"
												min={0}
												max={9}
												step={1}
												value={manualHomeMapScore}
												onChange={(event) => setManualHomeMapScore(event.target.value)}
												disabled={submitting}
											/>
										</div>
										<div>
											<p className="text-xs font-medium">Away map score</p>
											<Input
												aria-label="Away map score"
												type="number"
												min={0}
												max={9}
												step={1}
												value={manualAwayMapScore}
												onChange={(event) => setManualAwayMapScore(event.target.value)}
												disabled={submitting}
											/>
										</div>
									</div>
								)}
								<FieldError>{getFieldErrorText(fieldErrors, "homeMapScore")}</FieldError>
								<FieldError>{getFieldErrorText(fieldErrors, "awayMapScore")}</FieldError>
							</div>

							<div className="grid gap-3 sm:grid-cols-2">
								<div>
									<p className="text-xs font-medium">Started at</p>
									<Input
										aria-label="Started at"
										type="datetime-local"
										value={localStartedAt}
										onChange={(event) => setLocalStartedAt(event.target.value)}
										disabled={submitting}
									/>
								</div>
								<div>
									<p className="text-xs font-medium">Ended at</p>
									<Input
										aria-label="Ended at"
										type="datetime-local"
										value={localEndedAt}
										onChange={(event) => setLocalEndedAt(event.target.value)}
										disabled={submitting}
									/>
								</div>
							</div>

							<div className="bg-muted/30 p-3">
								<p className="text-sm font-semibold">Series scan draft</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Use a completed game-history scan to hydrate local map drafts. Review them before
									submitting; nothing is saved yet.
								</p>
								{reviewableJobs.length === 0 ? (
									<p className="mt-3 text-xs text-muted-foreground">
										No completed game-history scans are available for this scrim yet.
									</p>
								) : (
									<>
										<select
											value={selectedOcrJobId}
											onChange={(event) => setSelectedOcrJobId(event.target.value)}
											className="mt-3 h-9 w-full border bg-background px-3 text-sm"
											disabled={submitting}
										>
											{reviewableJobs.map((job) => (
												<option key={job.id} value={job.id}>
													{formatJobLabel(job)}
												</option>
											))}
										</select>
										<div className="mt-3 flex flex-wrap gap-2">
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={handleLoadOcrDraft}
												disabled={submitting}
											>
												Use scan as draft
											</Button>
											{maps.length > 0 ? (
												<Button
													type="button"
													size="sm"
													variant="outline"
													onClick={() => {
														setMaps([]);
														setSourceOcrJobId(null);
													}}
													disabled={submitting}
												>
													Clear map drafts
												</Button>
											) : null}
										</div>
									</>
								)}
								{loadedOcrJob?.validatedOutput?.warnings.length ? (
									<p className="mt-3 text-xs text-muted-foreground">
										Loaded warnings: {loadedOcrJob.validatedOutput.warnings.join(" | ")}
									</p>
								) : null}
							</div>
						</div>

						<div className="space-y-4 border p-4">
							<div className="flex items-center justify-between gap-2">
								<div>
									<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Reviewed maps
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										These rows are written to the real scrim result tables.
									</p>
								</div>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => setMaps((current) => [...current, createEmptyMapDraft()])}
									disabled={submitting}
								>
									Add map
								</Button>
							</div>

							{maps.length === 0 ? (
								<div className="bg-muted/30 p-4 text-sm text-muted-foreground">
									No reviewed maps yet. This submission will stay series-only unless you add or load
									maps.
								</div>
							) : (
								<div className="space-y-4">
									{maps.map((map, mapIndex) => (
										<div key={map.draftKey} className="bg-muted/30 p-4">
											<div className="flex items-center justify-between gap-2">
												<div>
													<p className="text-sm font-semibold">Map {mapIndex + 1}</p>
													<p className="mt-1 text-xs text-muted-foreground capitalize">
														Derived result: {deriveMapResult(map.homeScore, map.awayScore)}
													</p>
												</div>
												<Button
													type="button"
													size="sm"
													variant="outline"
													onClick={() =>
														setMaps((current) => current.filter((_, index) => index !== mapIndex))
													}
													disabled={submitting}
												>
													Remove
												</Button>
											</div>

											<div className="mt-4 grid gap-3 lg:grid-cols-5">
												<div className="lg:col-span-2">
													<p className="text-xs font-medium">Map name</p>
													<Input
														aria-label={`Map ${mapIndex + 1} name`}
														value={map.mapName}
														onChange={(event) =>
															updateMap(mapIndex, (current) => ({
																...current,
																mapName: event.target.value,
															}))
														}
														disabled={submitting}
													/>
												</div>
												<div>
													<p className="text-xs font-medium">Map type</p>
													<select
														aria-label={`Map ${mapIndex + 1} type`}
														value={map.mapType}
														onChange={(event) =>
															updateMap(mapIndex, (current) => ({
																...current,
																mapType: event.target.value as MapDraft["mapType"],
															}))
														}
														className="h-9 w-full border bg-background px-3 text-sm"
														disabled={submitting}
													>
														{OCR_MAP_TYPE_VALUES.map((value) => (
															<option key={value} value={value}>
																{value.replaceAll("_", " ")}
															</option>
														))}
													</select>
												</div>
												<div>
													<p className="text-xs font-medium">Home rounds</p>
													<Input
														aria-label={`Map ${mapIndex + 1} home rounds`}
														type="number"
														min={0}
														max={OCR_MAX_MAP_SCORE}
														step={1}
														value={map.homeScore}
														onChange={(event) =>
															updateMap(mapIndex, (current) => ({
																...current,
																homeScore: event.target.value,
															}))
														}
														disabled={submitting}
													/>
												</div>
												<div>
													<p className="text-xs font-medium">Away rounds</p>
													<Input
														aria-label={`Map ${mapIndex + 1} away rounds`}
														type="number"
														min={0}
														max={OCR_MAX_MAP_SCORE}
														step={1}
														value={map.awayScore}
														onChange={(event) =>
															updateMap(mapIndex, (current) => ({
																...current,
																awayScore: event.target.value,
															}))
														}
														disabled={submitting}
													/>
												</div>
											</div>

											<div className="mt-4 max-w-xs">
												<p className="text-xs font-medium">Duration (seconds)</p>
												<Input
													aria-label={`Map ${mapIndex + 1} duration in seconds`}
													type="number"
													min={0}
													max={7200}
													step={1}
													value={map.durationSeconds}
													onChange={(event) =>
														updateMap(mapIndex, (current) => ({
															...current,
															durationSeconds: event.target.value,
														}))
													}
													disabled={submitting}
												/>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>

					{formError ? <p className="text-sm text-destructive">{formError}</p> : null}

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={submitting}>
							{submitting && <Spinner className="mr-1.5" />}
							Submit series result
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
				<AlertDialog
					open={!!pendingSubmission}
					onOpenChange={(nextOpen) => {
						if (!nextOpen && !submitting) {
							setPendingSubmission(null);
							setPendingSubmissionMapCount(0);
						}
					}}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Submit a score-only result?</AlertDialogTitle>
							<AlertDialogDescription>
								This package records only the final series score, with no per-map detail. That is
								allowed for casual scrims; the opponent can still confirm or dispute the result, and
								you can add maps later by editing the result.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={submitting}>Keep editing</AlertDialogCancel>
							<AlertDialogAction
								disabled={submitting || !pendingSubmission}
								onClick={(event) => {
									event.preventDefault();
									if (pendingSubmission) {
										void submitResultPackage(pendingSubmission, pendingSubmissionMapCount);
									}
								}}
							>
								{submitting && <Spinner className="mr-1.5" />}
								Submit anyway
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</DialogContent>
		</Dialog>
	);
}
