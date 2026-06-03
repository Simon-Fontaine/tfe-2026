"use client";

import {
	type OCR_PLAYER_SIDE_VALUES,
	OCR_ROLE_VALUES,
	type OcrJobSummary,
	type OcrScoreboardPlayer,
	type OW2Role,
	type ScrimMapSummary,
} from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { apiRoutes } from "@/lib/routes";
import { getJobBadgeClass, getStageLabel } from "@/lib/scrims/ocr-status";
import { type FormFieldErrors, readApiPayload } from "./form-errors";

type PlayerSide = (typeof OCR_PLAYER_SIDE_VALUES)[number];

/** A roster member that a stat row can be linked to (either team). */
export type RosterLinkOption = {
	userId: string;
	displayName: string;
	role: OW2Role | null;
	mainHero: string;
};

type PlayerDraft = {
	userId: string | null;
	playerName: string;
	side: PlayerSide;
	hero: string;
	role: OW2Role | "";
	eliminations: string;
	assists: string;
	deaths: string;
	damage: string;
	healing: string;
	mitigation: string;
};

const STAT_FIELDS = [
	"eliminations",
	"assists",
	"deaths",
	"damage",
	"healing",
	"mitigation",
] as const;

type ScrimMapScoreboardDialogProps = {
	children: React.ReactNode;
	scrimId: string;
	map: ScrimMapSummary;
	reportingTeamId: string;
	reportingTeamSide: PlayerSide;
	ownRoster: RosterLinkOption[];
	opponentRoster: RosterLinkOption[];
	scoreboardJob: OcrJobSummary | null;
	canEdit: boolean;
};

function nullableNumberToField(value: number | null) {
	return value === null ? "" : String(value);
}

function savedPlayerToDraft(player: ScrimMapSummary["players"][number]): PlayerDraft {
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

function scoreboardPlayerToDraft(player: OcrScoreboardPlayer, side: PlayerSide): PlayerDraft {
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

function createEmptyPlayerDraft(side: PlayerSide): PlayerDraft {
	return {
		userId: null,
		playerName: "",
		side,
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

function parseOptionalInteger(value: string, label: string) {
	if (!value.trim()) return null;
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 0) {
		throw new Error(`${label} must be a whole number or left empty.`);
	}
	return parsed;
}

// Saved stats win, else the scan's rows (ally → reporting side), else empty.
function seedPlayers(
	map: ScrimMapSummary,
	scoreboardJob: OcrJobSummary | null,
	reportingTeamSide: PlayerSide
): PlayerDraft[] {
	if (map.players.length > 0) {
		return map.players.map(savedPlayerToDraft);
	}
	const output = scoreboardJob?.validatedOutput;
	if (output?.screenshotType === "scoreboard") {
		const enemySide: PlayerSide = reportingTeamSide === "home" ? "away" : "home";
		return [
			...output.allyTeam.map((player) => scoreboardPlayerToDraft(player, reportingTeamSide)),
			...output.enemyTeam.map((player) => scoreboardPlayerToDraft(player, enemySide)),
		];
	}
	return [];
}

export function ScrimMapScoreboardDialog({
	children,
	scrimId,
	map,
	reportingTeamId,
	reportingTeamSide,
	ownRoster,
	opponentRoster,
	scoreboardJob,
	canEdit,
}: ScrimMapScoreboardDialogProps) {
	const router = useRouter();
	const enemySide: PlayerSide = reportingTeamSide === "home" ? "away" : "home";

	const [open, setOpen] = useState(false);
	const [players, setPlayers] = useState<PlayerDraft[]>([]);
	const [imageUrl, setImageUrl] = useState<string | null>(null);
	const [imageLoading, setImageLoading] = useState(false);
	const [imageError, setImageError] = useState<string | null>(null);
	const [formError, setFormError] = useState<string | undefined>(undefined);
	const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
	const [submitting, setSubmitting] = useState(false);

	async function loadEvidenceImage(jobId: string) {
		setImageLoading(true);
		setImageError(null);
		try {
			const response = await fetch(apiRoutes.scrims.ocrJobEvidenceUrl(scrimId, jobId), {
				credentials: "include",
			});
			const payload = await readApiPayload<{ url: string; expiresAt: string }>(response);
			if (!response.ok || !payload.data) {
				setImageError(payload.error ?? "Unable to load the screenshot.");
				return;
			}
			setImageUrl(payload.data.url);
		} catch {
			setImageError("Unable to reach the API server.");
		} finally {
			setImageLoading(false);
		}
	}

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);
		if (nextOpen) {
			setPlayers(seedPlayers(map, scoreboardJob, reportingTeamSide));
			setFormError(undefined);
			setFieldErrors({});
			setImageUrl(null);
			setImageError(null);
			if (scoreboardJob) void loadEvidenceImage(scoreboardJob.id);
		}
	}

	function updatePlayer(playerIndex: number, updater: (current: PlayerDraft) => PlayerDraft) {
		setPlayers((current) =>
			current.map((player, index) => (index === playerIndex ? updater(player) : player))
		);
		setFormError(undefined);
	}

	function reseedFromScan() {
		if (scoreboardJob?.validatedOutput?.screenshotType !== "scoreboard") return;
		const output = scoreboardJob.validatedOutput;
		setPlayers([
			...output.allyTeam.map((player) => scoreboardPlayerToDraft(player, reportingTeamSide)),
			...output.enemyTeam.map((player) => scoreboardPlayerToDraft(player, enemySide)),
		]);
		setFormError(undefined);
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;
		setFormError(undefined);
		setFieldErrors({});

		try {
			const linkedKeys = new Set<string>();
			const parsedPlayers = players.map((player, playerIndex) => {
				if (!player.playerName.trim()) {
					throw new Error(`Player ${playerIndex + 1} needs a player name.`);
				}
				// Your own players must be linked; opponent rows may be linked or manual.
				if (player.side === reportingTeamSide && !player.userId) {
					throw new Error(
						`Player ${playerIndex + 1} (${player.playerName.trim()}) must be linked to a roster player.`
					);
				}
				if (player.userId) {
					const key = `${player.side}:${player.userId}`;
					if (linkedKeys.has(key)) {
						throw new Error("Each roster player can only be linked once per map.");
					}
					linkedKeys.add(key);
				}
				return {
					userId: player.userId ?? undefined,
					playerName: player.playerName.trim(),
					side: player.side,
					hero: player.hero.trim() || null,
					role: player.role || null,
					eliminations: parseOptionalInteger(
						player.eliminations,
						`Player ${playerIndex + 1} elims`
					),
					assists: parseOptionalInteger(player.assists, `Player ${playerIndex + 1} assists`),
					deaths: parseOptionalInteger(player.deaths, `Player ${playerIndex + 1} deaths`),
					damage: parseOptionalInteger(player.damage, `Player ${playerIndex + 1} damage`),
					healing: parseOptionalInteger(player.healing, `Player ${playerIndex + 1} healing`),
					mitigation: parseOptionalInteger(
						player.mitigation,
						`Player ${playerIndex + 1} mitigation`
					),
				};
			});

			setSubmitting(true);
			const response = await fetch(apiRoutes.scrims.mapPlayerStats(scrimId, map.id), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					reportingTeamId,
					scoreboardOcrJobId: scoreboardJob?.id ?? undefined,
					players: parsedPlayers,
				}),
			});
			const payload = await readApiPayload(response);
			if (!response.ok || !payload.data) {
				setFieldErrors(payload.fieldErrors ?? {});
				setFormError(payload.error ?? "Unable to save player stats.");
				return;
			}

			toast.success(
				parsedPlayers.length > 0 ? "Player stats saved." : "Player stats cleared for this map."
			);
			setOpen(false);
			startTransition(() => router.refresh());
		} catch (error) {
			setFormError(error instanceof Error ? error.message : "Unable to save player stats.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl">
				<DialogHeader>
					<DialogTitle>
						Scoreboard — Map {map.mapOrder}: {map.mapName}
					</DialogTitle>
					<DialogDescription>
						Check the extracted rows against the screenshot, fix anything the scan missed, then
						save. Saving player stats does not change the agreed score or reset confirmations.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
					<div className="space-y-3">
						<div className="flex items-center justify-between gap-2">
							<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Uploaded screenshot
							</p>
							{scoreboardJob ? (
								<Badge variant="outline" className={getJobBadgeClass(scoreboardJob)}>
									{getStageLabel(scoreboardJob)}
								</Badge>
							) : null}
						</div>
						<div className="flex min-h-48 items-center justify-center border bg-muted/30 p-2">
							{imageLoading ? (
								<Spinner />
							) : imageUrl ? (
								// biome-ignore lint/performance/noImgElement: short-lived signed cross-origin URL
								<img
									src={imageUrl}
									alt={`Scoreboard for map ${map.mapOrder}`}
									className="max-h-[60vh] w-full object-contain"
								/>
							) : imageError ? (
								<p className="text-xs text-destructive">{imageError}</p>
							) : (
								<p className="text-xs text-muted-foreground">
									No scoreboard screenshot uploaded for this map yet.
								</p>
							)}
						</div>
						{imageUrl ? (
							<Button asChild variant="link" size="xs" className="h-auto p-0 text-xs">
								<a href={imageUrl} target="_blank" rel="noreferrer">
									Open full size
								</a>
							</Button>
						) : null}
						{scoreboardJob?.validatedOutput?.screenshotType === "scoreboard" &&
						scoreboardJob.validatedOutput.warnings.length > 0 ? (
							<p className="text-xs text-muted-foreground">
								Scan warnings: {scoreboardJob.validatedOutput.warnings.join(" | ")}
							</p>
						) : null}
					</div>

					<form onSubmit={handleSubmit} className="space-y-3">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Player stats ({players.length})
							</p>
							{canEdit ? (
								<div className="flex flex-wrap gap-2">
									{scoreboardJob?.validatedOutput?.screenshotType === "scoreboard" ? (
										<Button type="button" size="sm" variant="outline" onClick={reseedFromScan}>
											Reset from scan
										</Button>
									) : null}
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() =>
											setPlayers((current) => [
												...current,
												createEmptyPlayerDraft(reportingTeamSide),
											])
										}
									>
										Add player
									</Button>
								</div>
							) : null}
						</div>

						{players.length === 0 ? (
							<p className="bg-muted/30 p-4 text-xs text-muted-foreground">
								No player rows yet. {canEdit ? "Add players or reset from a scan." : ""}
							</p>
						) : (
							<div className="space-y-3">
								{players.map((player, playerIndex) => {
									const isOurs = player.side === reportingTeamSide;
									const sideRoster = isOurs ? ownRoster : opponentRoster;
									return (
										<div key={`player-${playerIndex + 1}`} className="bg-muted/30 p-3">
											<div className="flex items-center justify-between gap-2">
												<p className="text-sm font-semibold">Player {playerIndex + 1}</p>
												{canEdit ? (
													<Button
														type="button"
														size="sm"
														variant="outline"
														onClick={() =>
															setPlayers((current) =>
																current.filter((_, index) => index !== playerIndex)
															)
														}
													>
														Remove
													</Button>
												) : null}
											</div>

											<div className="mt-3 grid gap-3 lg:grid-cols-4">
												<div>
													<p className="text-xs font-medium">Team</p>
													<select
														aria-label={`Player ${playerIndex + 1} team`}
														value={isOurs ? "ours" : "opponent"}
														onChange={(event) => {
															const nextOurs = event.target.value === "ours";
															updatePlayer(playerIndex, (current) => ({
																...current,
																// Switching team drops the roster link (rosters differ per side).
																userId: null,
																side: nextOurs ? reportingTeamSide : enemySide,
															}));
														}}
														className="h-9 w-full border bg-background px-3 text-sm"
														disabled={!canEdit}
													>
														<option value="ours">Your team</option>
														<option value="opponent">Opponent</option>
													</select>
												</div>
												<div>
													<p className="text-xs font-medium">
														Roster player
														{isOurs ? <span className="text-destructive"> *</span> : null}
													</p>
													<select
														aria-label={`Player ${playerIndex + 1} roster link`}
														value={player.userId ?? ""}
														onChange={(event) => {
															const linked = sideRoster.find(
																(option) => option.userId === event.target.value
															);
															updatePlayer(playerIndex, (current) => ({
																...current,
																userId: linked?.userId ?? null,
																playerName: linked?.displayName ?? current.playerName,
																role: (linked?.role as PlayerDraft["role"]) ?? current.role,
																hero: linked?.mainHero || current.hero,
															}));
														}}
														className="h-9 w-full border bg-background px-3 text-sm"
														disabled={!canEdit || sideRoster.length === 0}
													>
														<option value="">
															{isOurs ? "Select roster player…" : "Unlinked / manual"}
														</option>
														{player.userId &&
														!sideRoster.some((option) => option.userId === player.userId) ? (
															<option value={player.userId}>{player.playerName}</option>
														) : null}
														{sideRoster.map((option) => (
															<option key={option.userId} value={option.userId}>
																{option.displayName}
																{option.role ? ` · ${option.role}` : ""}
															</option>
														))}
													</select>
													{isOurs && !player.userId ? (
														<p className="mt-1 text-[11px] text-destructive">
															Link to a roster player.
														</p>
													) : null}
												</div>
												<div>
													<p className="text-xs font-medium">
														{isOurs ? "Display name" : "Opponent name"}
													</p>
													<Input
														aria-label={`Player ${playerIndex + 1} name`}
														value={player.playerName}
														onChange={(event) =>
															updatePlayer(playerIndex, (current) => ({
																...current,
																playerName: event.target.value,
															}))
														}
														disabled={!canEdit}
													/>
												</div>
												<div>
													<p className="text-xs font-medium">Role</p>
													<select
														aria-label={`Player ${playerIndex + 1} role`}
														value={player.role}
														onChange={(event) =>
															updatePlayer(playerIndex, (current) => ({
																...current,
																role: event.target.value as PlayerDraft["role"],
															}))
														}
														className="h-9 w-full border bg-background px-3 text-sm"
														disabled={!canEdit}
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

											<div className="mt-3 grid gap-3 lg:grid-cols-4">
												<div>
													<p className="text-xs font-medium">Hero</p>
													<Input
														aria-label={`Player ${playerIndex + 1} hero`}
														value={player.hero}
														onChange={(event) =>
															updatePlayer(playerIndex, (current) => ({
																...current,
																hero: event.target.value,
															}))
														}
														disabled={!canEdit}
													/>
												</div>
												{STAT_FIELDS.map((field) => (
													<div key={field}>
														<p className="text-xs font-medium capitalize">{field}</p>
														<Input
															aria-label={`Player ${playerIndex + 1} ${field}`}
															type="number"
															min={0}
															step={1}
															value={player[field]}
															onChange={(event) =>
																updatePlayer(playerIndex, (current) => ({
																	...current,
																	[field]: event.target.value,
																}))
															}
															disabled={!canEdit}
														/>
													</div>
												))}
											</div>
										</div>
									);
								})}
							</div>
						)}

						{formError ? <p className="text-sm text-destructive">{formError}</p> : null}
						{fieldErrors.players ? (
							<p className="text-sm text-destructive">{fieldErrors.players.join(" ")}</p>
						) : null}

						{canEdit ? (
							<div className="flex gap-2">
								<Button type="submit" size="sm" disabled={submitting}>
									{submitting && <Spinner className="mr-1.5" />}
									Save player stats
								</Button>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => setOpen(false)}
									disabled={submitting}
								>
									Cancel
								</Button>
							</div>
						) : (
							<p className="text-xs text-muted-foreground">
								You can review these stats but only the reporting team&apos;s managers can edit
								them.
							</p>
						)}
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
