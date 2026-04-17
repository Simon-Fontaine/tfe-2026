"use client";

import {
	OCR_MAP_TYPE_VALUES,
	OCR_PLAYER_SIDE_VALUES,
	OCR_ROLE_VALUES,
	type OcrGameHistoryMatch,
	type OcrScoreboardPlayer,
	type OW2Role,
	type ScrimDetail,
} from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
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
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { apiRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { type FormFieldErrors, getFieldErrorText, readApiPayload } from "./form-errors";

type PlayerDraft = {
	playerName: string;
	side: (typeof OCR_PLAYER_SIDE_VALUES)[number];
	hero: string;
	role: OW2Role | "";
	eliminations: string;
	assists: string;
	deaths: string;
	damage: string;
	healing: string;
	mitigation: string;
};

type MapDraft = {
	mapName: string;
	mapType: (typeof OCR_MAP_TYPE_VALUES)[number];
	scoreboardOcrJobId: string | null;
	homeScore: string;
	awayScore: string;
	durationSeconds: string;
	players: PlayerDraft[];
};

type ReportScrimResultDialogProps = {
	children: React.ReactNode;
	scrim: ScrimDetail;
	reportingTeamId: string;
};

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

function nullableNumberToField(value: number | null) {
	return value === null ? "" : String(value);
}

function createEmptyPlayerDraft(): PlayerDraft {
	return {
		playerName: "",
		side: "unknown",
		hero: "",
		role: "",
		eliminations: "",
		assists: "",
		deaths: "",
		damage: "",
		healing: "",
		mitigation: "",
	};
}

function createEmptyMapDraft(): MapDraft {
	return {
		mapName: "",
		mapType: "unknown",
		scoreboardOcrJobId: null,
		homeScore: "0",
		awayScore: "0",
		durationSeconds: "",
		players: [],
	};
}

function mapSavedPlayerToDraft(
	player: ScrimDetail["maps"][number]["players"][number]
): PlayerDraft {
	return {
		playerName: player.playerName,
		side: player.side,
		hero: player.hero ?? "",
		role: player.role ?? "",
		eliminations: nullableNumberToField(player.eliminations),
		assists: nullableNumberToField(player.assists),
		deaths: nullableNumberToField(player.deaths),
		damage: nullableNumberToField(player.damage),
		healing: nullableNumberToField(player.healing),
		mitigation: nullableNumberToField(player.mitigation),
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
		mapName: match.mapName,
		mapType: match.mapType ?? "unknown",
		scoreboardOcrJobId: null,
		homeScore: String(match.allyScore),
		awayScore: String(match.enemyScore),
		durationSeconds: durationTextToSecondsField(match.durationText),
		players: [],
	};
}

function mapSavedMapToDraft(map: ScrimDetail["maps"][number]): MapDraft {
	return {
		mapName: map.mapName,
		mapType: map.mapType,
		scoreboardOcrJobId: null,
		homeScore: String(map.homeScore),
		awayScore: String(map.awayScore),
		durationSeconds: nullableNumberToField(map.durationSeconds),
		players: map.players.map(mapSavedPlayerToDraft),
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

function deriveMapResult(homeScore: string, awayScore: string) {
	const parsedHomeScore = Number(homeScore);
	const parsedAwayScore = Number(awayScore);
	if (!Number.isFinite(parsedHomeScore) || !Number.isFinite(parsedAwayScore)) return "invalid";
	if (parsedHomeScore > parsedAwayScore) return "home win";
	if (parsedAwayScore > parsedHomeScore) return "away win";
	return "draw";
}

function mapScoreboardPlayerToDraft(
	player: OcrScoreboardPlayer,
	side: PlayerDraft["side"]
): PlayerDraft {
	return {
		playerName: player.playerName,
		side,
		hero: player.hero ?? "",
		role: player.role ?? "",
		eliminations: String(player.eliminations),
		assists: String(player.assists),
		deaths: String(player.deaths),
		damage: String(player.damage),
		healing: String(player.healing),
		mitigation: String(player.mitigation),
	};
}

export function ReportScrimResultDialog({
	children,
	scrim,
	reportingTeamId,
}: ReportScrimResultDialogProps) {
	const router = useRouter();
	const reviewableJobs = scrim.ocrJobs.filter(
		(job) => job.validatedOutput?.screenshotType === "game_history"
	);
	const scoreboardJobs = scrim.ocrJobs.filter(
		(job) => job.validatedOutput?.screenshotType === "scoreboard"
	);
	const initialState = getInitialState(scrim);
	const [open, setOpen] = useState(false);
	const [manualHomeMapScore, setManualHomeMapScore] = useState(initialState.manualHomeMapScore);
	const [manualAwayMapScore, setManualAwayMapScore] = useState(initialState.manualAwayMapScore);
	const [localStartedAt, setLocalStartedAt] = useState(initialState.startedAt);
	const [localEndedAt, setLocalEndedAt] = useState(initialState.endedAt);
	const [sourceOcrJobId, setSourceOcrJobId] = useState<string | null>(initialState.sourceOcrJobId);
	const [selectedOcrJobId, setSelectedOcrJobId] = useState(reviewableJobs[0]?.id ?? "");
	const [selectedScoreboardJobId, setSelectedScoreboardJobId] = useState(
		scoreboardJobs[0]?.id ?? ""
	);
	const [selectedScoreboardMapIndex, setSelectedScoreboardMapIndex] = useState("0");
	const [maps, setMaps] = useState<MapDraft[]>(initialState.maps);
	const [formError, setFormError] = useState<string | undefined>(undefined);
	const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
	const [submitting, setSubmitting] = useState(false);

	function resetState() {
		const nextState = getInitialState(scrim);
		setManualHomeMapScore(nextState.manualHomeMapScore);
		setManualAwayMapScore(nextState.manualAwayMapScore);
		setLocalStartedAt(nextState.startedAt);
		setLocalEndedAt(nextState.endedAt);
		setSourceOcrJobId(nextState.sourceOcrJobId);
		setSelectedOcrJobId(reviewableJobs[0]?.id ?? "");
		setSelectedScoreboardJobId(scoreboardJobs[0]?.id ?? "");
		setSelectedScoreboardMapIndex("0");
		setMaps(nextState.maps);
		setFormError(undefined);
		setFieldErrors({});
	}

	function updateMap(mapIndex: number, updater: (current: MapDraft) => MapDraft) {
		setMaps((current) => current.map((map, index) => (index === mapIndex ? updater(map) : map)));
		setFormError(undefined);
	}

	function updatePlayer(
		mapIndex: number,
		playerIndex: number,
		updater: (current: PlayerDraft) => PlayerDraft
	) {
		updateMap(mapIndex, (map) => ({
			...map,
			players: map.players.map((player, index) =>
				index === playerIndex ? updater(player) : player
			),
		}));
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

	function handleImportScoreboardDraft() {
		const selectedJob = scoreboardJobs.find((job) => job.id === selectedScoreboardJobId);
		if (
			!selectedJob?.validatedOutput ||
			selectedJob.validatedOutput.screenshotType !== "scoreboard"
		) {
			setFormError("Select a completed scoreboard OCR draft before importing player stats.");
			return;
		}

		const mapIndex = Number(selectedScoreboardMapIndex);
		if (!Number.isInteger(mapIndex) || mapIndex < 0 || mapIndex >= maps.length) {
			setFormError("Select a reviewed map before importing scoreboard player stats.");
			return;
		}

		const allySide: PlayerDraft["side"] = reportingTeamId === scrim.homeTeam.id ? "home" : "away";
		const enemySide: PlayerDraft["side"] = allySide === "home" ? "away" : "home";
		const importedPlayers = [
			...selectedJob.validatedOutput.allyTeam.map((player) =>
				mapScoreboardPlayerToDraft(player, allySide)
			),
			...selectedJob.validatedOutput.enemyTeam.map((player) =>
				mapScoreboardPlayerToDraft(player, enemySide)
			),
		];

		updateMap(mapIndex, (current) => ({
			...current,
			scoreboardOcrJobId: selectedJob.id,
			players: importedPlayers,
		}));
		setFormError(undefined);
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;
		setSubmitting(true);
		setFormError(undefined);
		setFieldErrors({});

		try {
			const parsedMaps = maps.map((map, mapIndex) => {
				if (!map.mapName.trim()) throw new Error(`Map ${mapIndex + 1} needs a map name.`);
				return {
					mapName: map.mapName.trim(),
					mapType: map.mapType,
					homeScore: parseRequiredScore(map.homeScore, `Map ${mapIndex + 1} home score`),
					awayScore: parseRequiredScore(map.awayScore, `Map ${mapIndex + 1} away score`),
					durationSeconds: parseOptionalInteger(
						map.durationSeconds,
						`Map ${mapIndex + 1} duration`
					),
					scoreboardOcrJobId: map.scoreboardOcrJobId ?? undefined,
					players: map.players.map((player, playerIndex) => {
						if (!player.playerName.trim()) {
							throw new Error(`Map ${mapIndex + 1} player ${playerIndex + 1} needs a player name.`);
						}
						return {
							playerName: player.playerName.trim(),
							side: player.side,
							hero: player.hero.trim() || null,
							role: player.role || null,
							eliminations: parseOptionalInteger(
								player.eliminations,
								`Map ${mapIndex + 1} player ${playerIndex + 1} eliminations`
							),
							assists: parseOptionalInteger(
								player.assists,
								`Map ${mapIndex + 1} player ${playerIndex + 1} assists`
							),
							deaths: parseOptionalInteger(
								player.deaths,
								`Map ${mapIndex + 1} player ${playerIndex + 1} deaths`
							),
							damage: parseOptionalInteger(
								player.damage,
								`Map ${mapIndex + 1} player ${playerIndex + 1} damage`
							),
							healing: parseOptionalInteger(
								player.healing,
								`Map ${mapIndex + 1} player ${playerIndex + 1} healing`
							),
							mitigation: parseOptionalInteger(
								player.mitigation,
								`Map ${mapIndex + 1} player ${playerIndex + 1} mitigation`
							),
						};
					}),
				};
			});

			const resolvedSeriesScore =
				parsedMaps.length > 0
					? deriveSeriesScoreFromDraftMaps(maps)
					: {
							homeMapScore: parseRequiredScore(manualHomeMapScore, "Home map score"),
							awayMapScore: parseRequiredScore(manualAwayMapScore, "Away map score"),
						};

			const response = await fetch(apiRoutes.scrims.result(scrim.id), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					reportingTeamId,
					homeMapScore: resolvedSeriesScore.homeMapScore,
					awayMapScore: resolvedSeriesScore.awayMapScore,
					startedAt: toIsoTimestamp(localStartedAt),
					endedAt: toIsoTimestamp(localEndedAt),
					sourceOcrJobId: parsedMaps.length > 0 ? (sourceOcrJobId ?? undefined) : undefined,
					maps: parsedMaps.length > 0 ? parsedMaps : undefined,
				}),
			});
			const payload = await readApiPayload<ScrimDetail>(response);
			if (!response.ok || !payload.data) {
				setFieldErrors(payload.fieldErrors ?? {});
				setFormError(payload.error ?? "Unable to submit scrim results.");
				return;
			}

			toast.success(
				parsedMaps.length > 0 ? "Reviewed scrim result submitted." : "Scrim result submitted."
			);
			resetState();
			setOpen(false);
			startTransition(() => router.refresh());
		} catch (error) {
			setFormError(error instanceof Error ? error.message : "Unable to validate the scrim result.");
		} finally {
			setSubmitting(false);
		}
	}

	const derivedSeriesScore = deriveSeriesScoreFromDraftMaps(maps);
	const loadedOcrJob = sourceOcrJobId
		? reviewableJobs.find((job) => job.id === sourceOcrJobId)
		: null;
	const selectedScoreboardJob = selectedScoreboardJobId
		? scoreboardJobs.find((job) => job.id === selectedScoreboardJobId)
		: null;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				if (!nextOpen) resetState();
			}}
		>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-6xl">
				<DialogHeader>
					<DialogTitle>Review scrim result</DialogTitle>
					<DialogDescription>
						Submit a final result package for both teams to confirm. Use OCR drafts when possible,
						but this editor also supports fully manual review.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-6">
					<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
						<div className="space-y-4 border p-4">
							<div>
								<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Series result
								</p>
								{maps.length > 0 ? (
									<div className="mt-2 border p-3 text-sm font-semibold">
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

							<div className="border p-3">
								<p className="text-sm font-semibold">OCR draft import</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Load a completed game-history OCR job to prefill reviewed map rows. Scoreboard OCR
									remains separate evidence for player-stat review.
								</p>
								{reviewableJobs.length === 0 ? (
									<p className="mt-3 text-xs text-muted-foreground">
										No completed OCR drafts are available for this scrim yet.
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
												Load OCR draft
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
													Clear detailed maps
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

							<div className="border p-3">
								<p className="text-sm font-semibold">Scoreboard player-stat import</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Import a completed scoreboard OCR draft into one reviewed map. This replaces the
									current player rows for that map and keeps the OCR job attached as supporting
									evidence.
								</p>
								{scoreboardJobs.length === 0 ? (
									<p className="mt-3 text-xs text-muted-foreground">
										No completed scoreboard OCR drafts are available for this scrim yet.
									</p>
								) : maps.length === 0 ? (
									<p className="mt-3 text-xs text-muted-foreground">
										Add or load at least one reviewed map before importing scoreboard player stats.
									</p>
								) : (
									<>
										<select
											value={selectedScoreboardJobId}
											onChange={(event) => setSelectedScoreboardJobId(event.target.value)}
											className="mt-3 h-9 w-full border bg-background px-3 text-sm"
											disabled={submitting}
										>
											{scoreboardJobs.map((job) => (
												<option key={job.id} value={job.id}>
													{formatJobLabel(job)}
												</option>
											))}
										</select>
										<select
											value={selectedScoreboardMapIndex}
											onChange={(event) => setSelectedScoreboardMapIndex(event.target.value)}
											className="mt-3 h-9 w-full border bg-background px-3 text-sm"
											disabled={submitting}
										>
											{maps.map((map, index) => (
												<option
													key={`scoreboard-target-${map.mapName}-${map.homeScore}-${map.awayScore}-${map.players.length}`}
													value={String(index)}
												>
													Map {index + 1}: {map.mapName || "Unnamed map"}
												</option>
											))}
										</select>
										<div className="mt-3 flex flex-wrap gap-2">
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={handleImportScoreboardDraft}
												disabled={submitting}
											>
												Import scoreboard stats
											</Button>
										</div>
									</>
								)}
								{selectedScoreboardJob?.validatedOutput?.warnings.length ? (
									<p className="mt-3 text-xs text-muted-foreground">
										Loaded warnings: {selectedScoreboardJob.validatedOutput.warnings.join(" | ")}
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
								<div className="border p-4 text-sm text-muted-foreground">
									No reviewed maps yet. This submission will stay series-only unless you add or load
									maps.
								</div>
							) : (
								<div className="space-y-4">
									{maps.map((map, mapIndex) => (
										<div key={`map-${mapIndex + 1}`} className="border p-4">
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
														max={9}
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
														max={9}
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

											{map.scoreboardOcrJobId ? (
												<p className="mt-3 text-xs text-muted-foreground">
													Player stats imported from scoreboard OCR job {map.scoreboardOcrJobId}.
												</p>
											) : null}

											<details className="mt-4 border p-3">
												<summary className="cursor-pointer text-sm font-semibold">
													Player stats ({map.players.length})
												</summary>
												<div className="mt-4 space-y-4">
													<div className="flex justify-end">
														<Button
															type="button"
															size="sm"
															variant="outline"
															onClick={() =>
																updateMap(mapIndex, (current) => ({
																	...current,
																	players: [...current.players, createEmptyPlayerDraft()],
																}))
															}
															disabled={submitting}
														>
															Add player
														</Button>
													</div>

													{map.players.length === 0 ? (
														<p className="text-xs text-muted-foreground">
															No player stats stored for this map.
														</p>
													) : (
														map.players.map((player, playerIndex) => (
															<div
																key={`map-${mapIndex + 1}-player-${playerIndex + 1}`}
																className={cn(
																	"border p-3",
																	player.side === "unknown" && "bg-muted/20"
																)}
															>
																<div className="flex items-center justify-between gap-2">
																	<p className="text-sm font-semibold">Player {playerIndex + 1}</p>
																	<Button
																		type="button"
																		size="sm"
																		variant="outline"
																		onClick={() =>
																			updateMap(mapIndex, (current) => ({
																				...current,
																				scoreboardOcrJobId:
																					current.players.length <= 1
																						? null
																						: current.scoreboardOcrJobId,
																				players: current.players.filter(
																					(_, index) => index !== playerIndex
																				),
																			}))
																		}
																		disabled={submitting}
																	>
																		Remove
																	</Button>
																</div>

																<div className="mt-4 grid gap-3 lg:grid-cols-4">
																	<div className="lg:col-span-2">
																		<p className="text-xs font-medium">Player name</p>
																		<Input
																			aria-label={`Map ${mapIndex + 1} player ${playerIndex + 1} name`}
																			value={player.playerName}
																			onChange={(event) =>
																				updatePlayer(mapIndex, playerIndex, (current) => ({
																					...current,
																					playerName: event.target.value,
																				}))
																			}
																			disabled={submitting}
																		/>
																	</div>
																	<div>
																		<p className="text-xs font-medium">Side</p>
																		<select
																			aria-label={`Map ${mapIndex + 1} player ${playerIndex + 1} side`}
																			value={player.side}
																			onChange={(event) =>
																				updatePlayer(mapIndex, playerIndex, (current) => ({
																					...current,
																					side: event.target.value as PlayerDraft["side"],
																				}))
																			}
																			className="h-9 w-full border bg-background px-3 text-sm"
																			disabled={submitting}
																		>
																			{OCR_PLAYER_SIDE_VALUES.map((value) => (
																				<option key={value} value={value}>
																					{value}
																				</option>
																			))}
																		</select>
																	</div>
																	<div>
																		<p className="text-xs font-medium">Role</p>
																		<select
																			aria-label={`Map ${mapIndex + 1} player ${playerIndex + 1} role`}
																			value={player.role}
																			onChange={(event) =>
																				updatePlayer(mapIndex, playerIndex, (current) => ({
																					...current,
																					role: event.target.value as PlayerDraft["role"],
																				}))
																			}
																			className="h-9 w-full border bg-background px-3 text-sm"
																			disabled={submitting}
																		>
																			<option value="">Unknown</option>
																			{OCR_ROLE_VALUES.map((value) => (
																				<option key={value} value={value}>
																					{value}
																				</option>
																			))}
																		</select>
																	</div>
																</div>

																<div className="mt-4 grid gap-3 lg:grid-cols-4">
																	<div>
																		<p className="text-xs font-medium">Hero</p>
																		<Input
																			aria-label={`Map ${mapIndex + 1} player ${playerIndex + 1} hero`}
																			value={player.hero}
																			onChange={(event) =>
																				updatePlayer(mapIndex, playerIndex, (current) => ({
																					...current,
																					hero: event.target.value,
																				}))
																			}
																			disabled={submitting}
																		/>
																	</div>
																	{(
																		[
																			"eliminations",
																			"assists",
																			"deaths",
																			"damage",
																			"healing",
																			"mitigation",
																		] as const
																	).map((field) => (
																		<div key={field}>
																			<p className="text-xs font-medium capitalize">{field}</p>
																			<Input
																				aria-label={`Map ${mapIndex + 1} player ${playerIndex + 1} ${field}`}
																				type="number"
																				min={0}
																				step={1}
																				value={player[field]}
																				onChange={(event) =>
																					updatePlayer(mapIndex, playerIndex, (current) => ({
																						...current,
																						[field]: event.target.value,
																					}))
																				}
																				disabled={submitting}
																			/>
																		</div>
																	))}
																</div>
															</div>
														))
													)}
												</div>
											</details>
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
							Submit reviewed result
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
