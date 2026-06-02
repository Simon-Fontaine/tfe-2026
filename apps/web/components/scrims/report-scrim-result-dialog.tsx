"use client";

import {
	OCR_MAP_TYPE_VALUES,
	OCR_PLAYER_SIDE_VALUES,
	OCR_ROLE_VALUES,
	type OcrGameHistoryMatch,
	type OcrScoreboardPlayer,
	type OW2Role,
	type ScrimDetail,
	type TeamMemberSummary,
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
import { cn } from "@/lib/utils";
import { type FormFieldErrors, getFieldErrorText, readApiPayload } from "./form-errors";

type PlayerDraft = {
	userId: string | null;
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
	draftKey: string;
	mapId: string | null;
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
	rosterPlayers?: TeamMemberSummary[];
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
		scoreboardOcrJobId?: string;
		players: Array<{
			userId?: string;
			playerName: string;
			side: PlayerDraft["side"];
			hero: string | null;
			role: OW2Role | null;
			eliminations: number | null;
			assists: number | null;
			deaths: number | null;
			damage: number | null;
			healing: number | null;
			mitigation: number | null;
		}>;
	}>;
};

function nullableNumberToField(value: number | null) {
	return value === null ? "" : String(value);
}

function createEmptyPlayerDraft(): PlayerDraft {
	return {
		userId: null,
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
		draftKey: `manual-${crypto.randomUUID()}`,
		mapId: null,
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
		userId: player.userId ?? null,
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
		draftKey: `ocr-${match.matchOrder}-${match.mapName}-${match.allyScore}-${match.enemyScore}`,
		mapId: null,
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
		draftKey: `saved-${map.id}`,
		mapId: map.id,
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
		userId: null,
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
	rosterPlayers = [],
}: ReportScrimResultDialogProps) {
	const router = useRouter();
	const reportingTeamSide: PlayerDraft["side"] =
		reportingTeamId === scrim.homeTeam.id ? "home" : "away";
	const rosterOptions = rosterPlayers
		.filter((player) => player.status !== "inactive")
		.map((player) => ({
			userId: player.userId,
			displayName: player.displayName,
			username: player.username,
			role: player.roleInTeam ?? player.gameRole ?? null,
			mainHero: player.mainHero?.displayName ?? "",
		}))
		.sort((a, b) => a.displayName.localeCompare(b.displayName));
	const reviewableJobs = scrim.ocrJobs.filter(
		(job) => job.status === "completed" && job.validatedOutput?.screenshotType === "game_history"
	);
	const scoreboardJobs = scrim.ocrJobs.filter(
		(job) => job.status === "completed" && job.validatedOutput?.screenshotType === "scoreboard"
	);
	const associatedScoreboardJobs = scoreboardJobs.filter((job) => job.scrimMapId !== null);
	const legacyScoreboardJobs = scoreboardJobs.filter((job) => job.scrimMapId === null);
	const initialState = getInitialState(scrim);
	const [open, setOpen] = useState(false);
	const [manualHomeMapScore, setManualHomeMapScore] = useState(initialState.manualHomeMapScore);
	const [manualAwayMapScore, setManualAwayMapScore] = useState(initialState.manualAwayMapScore);
	const [localStartedAt, setLocalStartedAt] = useState(initialState.startedAt);
	const [localEndedAt, setLocalEndedAt] = useState(initialState.endedAt);
	const [sourceOcrJobId, setSourceOcrJobId] = useState<string | null>(initialState.sourceOcrJobId);
	const [selectedOcrJobId, setSelectedOcrJobId] = useState(reviewableJobs[0]?.id ?? "");
	const [selectedScoreboardJobId, setSelectedScoreboardJobId] = useState(
		legacyScoreboardJobs[0]?.id ?? ""
	);
	const [selectedScoreboardMapIndex, setSelectedScoreboardMapIndex] = useState("0");
	const [scoreboardPreview, setScoreboardPreview] = useState<{
		jobId: string;
		mapKey: string;
	} | null>(null);
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
		setSelectedScoreboardJobId(legacyScoreboardJobs[0]?.id ?? "");
		setSelectedScoreboardMapIndex("0");
		setScoreboardPreview(null);
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

	function importScoreboardJobIntoMapIndex(job: ScrimDetail["ocrJobs"][number], mapIndex: number) {
		if (!job.validatedOutput || job.validatedOutput.screenshotType !== "scoreboard") return;
		const allySide: PlayerDraft["side"] = reportingTeamId === scrim.homeTeam.id ? "home" : "away";
		const enemySide: PlayerDraft["side"] = allySide === "home" ? "away" : "home";
		const importedPlayers = [
			...job.validatedOutput.allyTeam.map((player) => mapScoreboardPlayerToDraft(player, allySide)),
			...job.validatedOutput.enemyTeam.map((player) =>
				mapScoreboardPlayerToDraft(player, enemySide)
			),
		];
		updateMap(mapIndex, (current) => ({
			...current,
			scoreboardOcrJobId: job.id,
			players: importedPlayers,
		}));
		setFormError(undefined);
	}

	function handleImportAssociatedScoreboardDraft(jobId: string) {
		const job = associatedScoreboardJobs.find((j) => j.id === jobId);
		if (!job?.validatedOutput || job.validatedOutput.screenshotType !== "scoreboard") {
			setFormError("OCR job not ready for import.");
			return;
		}
		const mapIndex = maps.findIndex((m) => m.mapId === job.scrimMapId);
		if (mapIndex === -1) {
			setFormError(
				"The target map for this scoreboard job is not in the current reviewed maps. Load the saved maps first."
			);
			return;
		}
		setScoreboardPreview({ jobId: job.id, mapKey: maps[mapIndex].draftKey });
		setFormError(undefined);
	}

	function handleImportScoreboardDraft() {
		const selectedJob = legacyScoreboardJobs.find((job) => job.id === selectedScoreboardJobId);
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

		setScoreboardPreview({ jobId: selectedJob.id, mapKey: maps[mapIndex].draftKey });
		setFormError(undefined);
	}

	function handleApplyScoreboardPreview() {
		if (!scoreboardPreview) return;
		const selectedJob = scoreboardJobs.find((job) => job.id === scoreboardPreview.jobId);
		if (
			!selectedJob?.validatedOutput ||
			selectedJob.validatedOutput.screenshotType !== "scoreboard"
		) {
			setFormError("OCR job not ready for import.");
			return;
		}
		const mapIndex = maps.findIndex((map) => map.draftKey === scoreboardPreview.mapKey);
		if (mapIndex === -1) {
			setFormError("The target map changed. Review the scoreboard again before applying stats.");
			setScoreboardPreview(null);
			return;
		}
		if (selectedJob.scrimMapId) {
			const targetMap = maps[mapIndex];
			if (targetMap.mapId !== selectedJob.scrimMapId) {
				setFormError(
					"This scoreboard belongs to another map. Review the correct map before applying stats."
				);
				setScoreboardPreview(null);
				return;
			}
		}
		importScoreboardJobIntoMapIndex(selectedJob, mapIndex);
		setScoreboardPreview(null);
	}

	function shouldWarnAboutEvidence(parsedMaps: ResultSubmissionPayload["maps"]) {
		if (!parsedMaps || parsedMaps.length === 0) return true;
		return parsedMaps.some((map) => !map.scoreboardOcrJobId || map.players.length === 0);
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
				mapCount > 0 ? "Result package submitted for confirmation." : "Series score submitted."
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
							userId: player.userId ?? undefined,
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

			const payload: ResultSubmissionPayload = {
				reportingTeamId,
				homeMapScore: resolvedSeriesScore.homeMapScore,
				awayMapScore: resolvedSeriesScore.awayMapScore,
				startedAt: toIsoTimestamp(localStartedAt),
				endedAt: toIsoTimestamp(localEndedAt),
				sourceOcrJobId: parsedMaps.length > 0 ? (sourceOcrJobId ?? undefined) : undefined,
				maps: parsedMaps.length > 0 ? parsedMaps : undefined,
			};

			if (shouldWarnAboutEvidence(payload.maps)) {
				setPendingSubmission(payload);
				setPendingSubmissionMapCount(parsedMaps.length);
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
	const selectedScoreboardJob = selectedScoreboardJobId
		? legacyScoreboardJobs.find((job) => job.id === selectedScoreboardJobId)
		: null;
	const previewScoreboardJob = scoreboardPreview
		? scoreboardJobs.find((job) => job.id === scoreboardPreview.jobId)
		: null;
	const previewMapIndex = scoreboardPreview
		? maps.findIndex((map) => map.draftKey === scoreboardPreview.mapKey)
		: -1;
	const previewMap = previewMapIndex === -1 ? null : maps[previewMapIndex];
	const mapsWithScoreboards = maps.filter((map) => !!map.scoreboardOcrJobId).length;
	const mapsWithPlayers = maps.filter((map) => map.players.length > 0).length;

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
					<DialogTitle>Result Workbench</DialogTitle>
					<DialogDescription>
						Build a draft match result package map by map. OCR only changes this draft until you
						submit it for both teams to confirm.
					</DialogDescription>
				</DialogHeader>

				{scrim.status === "completed" ? (
					<div className="bg-muted/40 p-3 text-xs text-muted-foreground">
						<strong>This result is locked.</strong> Both teams have confirmed — the result can no
						longer be replaced through this editor.
					</div>
				) : scrim.maps.length > 0 ||
					scrim.status === "awaiting_confirmation" ||
					scrim.status === "disputed" ? (
					<div className="bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
						<strong>Existing result will be replaced.</strong> Submitting overwrites the current map
						rows and resets both teams&apos; confirmations. The previous result is preserved in
						revision history.
					</div>
				) : null}

				<form onSubmit={handleSubmit} className="space-y-6">
					<div className="grid gap-3 sm:grid-cols-3">
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
									Verified stats
								</p>
								<p className="mt-1 text-lg font-semibold">
									{mapsWithScoreboards}/{maps.length || 0}
								</p>
								<p className="text-xs text-muted-foreground">Optional scoreboard-backed maps.</p>
							</CardContent>
						</Card>
						<Card size="sm">
							<CardContent>
								<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
									Player rows
								</p>
								<p className="mt-1 text-lg font-semibold">
									{mapsWithPlayers}/{maps.length || 0}
								</p>
								<p className="text-xs text-muted-foreground">
									Stats can stay empty for score-only reports.
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

							<div className="bg-muted/30 p-3">
								<p className="text-sm font-semibold">Scoreboard stat review</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Preview completed scoreboard scans before applying player rows to a map draft.
									Scoreboards are optional evidence, not a submission requirement.
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
									<div className="mt-3 space-y-3">
										{associatedScoreboardJobs.length > 0 ? (
											<div>
												<p className="text-xs font-medium text-muted-foreground">
													Map-associated jobs
												</p>
												<div className="mt-2 space-y-2">
													{associatedScoreboardJobs.map((job) => {
														const targetMapIndex = maps.findIndex(
															(m) => m.mapId === job.scrimMapId
														);
														const targetMap = targetMapIndex !== -1 ? maps[targetMapIndex] : null;
														return (
															<div
																key={job.id}
																className="flex items-center justify-between gap-2 text-xs"
															>
																<span className="text-muted-foreground">
																	{formatJobLabel(job)}
																	{targetMap
																		? ` → Map ${targetMapIndex + 1}: ${targetMap.mapName || "Unnamed map"}`
																		: " → target map not loaded"}
																</span>
																<Button
																	type="button"
																	size="sm"
																	variant="outline"
																	onClick={() => handleImportAssociatedScoreboardDraft(job.id)}
																	disabled={submitting || targetMapIndex === -1}
																>
																	Review stats
																</Button>
															</div>
														);
													})}
												</div>
											</div>
										) : null}

										{legacyScoreboardJobs.length > 0 ? (
											<div>
												<p className="text-xs font-medium text-muted-foreground">
													Unassociated (legacy) — select target map manually
												</p>
												<select
													value={selectedScoreboardJobId}
													onChange={(event) => setSelectedScoreboardJobId(event.target.value)}
													className="mt-2 h-9 w-full border bg-background px-3 text-sm"
													disabled={submitting}
												>
													{legacyScoreboardJobs.map((job) => (
														<option key={job.id} value={job.id}>
															{formatJobLabel(job)}
														</option>
													))}
												</select>
												<select
													value={selectedScoreboardMapIndex}
													onChange={(event) => setSelectedScoreboardMapIndex(event.target.value)}
													className="mt-2 h-9 w-full border bg-background px-3 text-sm"
													disabled={submitting}
												>
													{maps.map((map, index) => (
														<option key={`scoreboard-target-${map.draftKey}`} value={String(index)}>
															Map {index + 1}: {map.mapName || "Unnamed map"}
														</option>
													))}
												</select>
												<div className="mt-2 flex flex-wrap gap-2">
													<Button
														type="button"
														size="sm"
														variant="outline"
														onClick={handleImportScoreboardDraft}
														disabled={submitting}
													>
														Review stats
													</Button>
												</div>
												{selectedScoreboardJob?.validatedOutput?.warnings.length ? (
													<p className="mt-2 text-xs text-muted-foreground">
														Loaded warnings:{" "}
														{selectedScoreboardJob.validatedOutput.warnings.join(" | ")}
													</p>
												) : null}
											</div>
										) : null}

										{previewScoreboardJob?.validatedOutput?.screenshotType === "scoreboard" &&
										previewMap ? (
											<div className="bg-background p-3">
												<div className="flex flex-wrap items-start justify-between gap-2">
													<div>
														<p className="text-sm font-semibold">
															Preview stats for Map{" "}
															{previewMapIndex === -1 ? "" : previewMapIndex + 1}:{" "}
															{previewMap.mapName || "Unnamed map"}
														</p>
														<p className="mt-1 text-xs text-muted-foreground">
															Review the extracted rows before applying them to the local draft.
														</p>
													</div>
													<Button
														type="button"
														size="sm"
														onClick={handleApplyScoreboardPreview}
														disabled={submitting}
													>
														Apply to draft
													</Button>
												</div>
												<div className="mt-3 grid gap-3 lg:grid-cols-2">
													{(
														[
															["Ally team", previewScoreboardJob.validatedOutput.allyTeam],
															["Enemy team", previewScoreboardJob.validatedOutput.enemyTeam],
														] as const
													).map(([label, players]) => (
														<div key={label} className="bg-background p-2">
															<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
																{label}
															</p>
															<div className="mt-2 space-y-1 text-xs">
																{players.length > 0 ? (
																	players.map((player, index) => (
																		<p key={`${previewScoreboardJob.id}-${label}-${index}`}>
																			<span className="font-medium">
																				{player.playerName || "Unknown player"}
																			</span>{" "}
																			<span className="text-muted-foreground">
																				E {player.eliminations} · A {player.assists} · D{" "}
																				{player.deaths} · DMG {player.damage} · HEAL{" "}
																				{player.healing} · MIT {player.mitigation}
																			</span>
																		</p>
																	))
																) : (
																	<p className="text-muted-foreground">No visible rows.</p>
																)}
															</div>
														</div>
													))}
												</div>
												{previewScoreboardJob.validatedOutput.warnings.length > 0 ? (
													<p className="mt-3 text-xs text-muted-foreground">
														Warnings: {previewScoreboardJob.validatedOutput.warnings.join(" | ")}
													</p>
												) : null}
											</div>
										) : null}
									</div>
								)}
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
													Verified stats applied from scoreboard evidence. They remain draft-only
													until submission.
												</p>
											) : null}

											<details className="mt-4 bg-background p-3">
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
																	"bg-card p-3",
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

																<div className="mt-4 grid gap-3 lg:grid-cols-6">
																	<div className="lg:col-span-2">
																		<p className="text-xs font-medium">Roster link</p>
																		<select
																			aria-label={`Map ${mapIndex + 1} player ${playerIndex + 1} roster link`}
																			value={player.userId ?? ""}
																			onChange={(event) => {
																				const linkedPlayer = rosterOptions.find(
																					(option) => option.userId === event.target.value
																				);
																				updatePlayer(mapIndex, playerIndex, (current) => ({
																					...current,
																					userId: linkedPlayer?.userId ?? null,
																					playerName:
																						linkedPlayer?.displayName ?? current.playerName,
																					role:
																						(linkedPlayer?.role as PlayerDraft["role"]) ??
																						current.role,
																					hero: linkedPlayer?.mainHero || current.hero,
																				}));
																			}}
																			className="h-9 w-full border bg-background px-3 text-sm"
																			disabled={submitting || player.side !== reportingTeamSide}
																		>
																			<option value="">
																				{player.side === reportingTeamSide
																					? "Unlinked / manual"
																					: "Unavailable for this side"}
																			</option>
																			{player.userId &&
																			!rosterOptions.some(
																				(option) => option.userId === player.userId
																			) ? (
																				<option value={player.userId}>{player.playerName}</option>
																			) : null}
																			{rosterOptions.map((option) => (
																				<option key={option.userId} value={option.userId}>
																					{option.displayName}
																					{option.role ? ` · ${option.role}` : ""}
																				</option>
																			))}
																		</select>
																		<p className="mt-1 text-[11px] text-muted-foreground">
																			{player.side === reportingTeamSide
																				? "Links this stat row to a roster player."
																				: "Opponent rows stay manual unless their roster is available."}
																		</p>
																	</div>
																	<div className="lg:col-span-2">
																		<p className="text-xs font-medium">Display / OCR name</p>
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
																					userId:
																						event.target.value === reportingTeamSide
																							? current.userId
																							: null,
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
							Submit Result Package
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
							<AlertDialogTitle>Submit with partial evidence?</AlertDialogTitle>
							<AlertDialogDescription>
								{pendingSubmissionMapCount === 0
									? "This package is a score-only result without map or screenshot evidence. That is allowed for casual scrims; the opponent can still confirm or dispute the result."
									: "This package is logically valid, but some maps have no scoreboard-backed player stats. That is allowed for casual scrims; the opponent can still confirm or dispute the result."}
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
