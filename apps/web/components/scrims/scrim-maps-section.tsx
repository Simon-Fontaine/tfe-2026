import type { ScrimDetail } from "@scrimflow/shared";
import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";

function formatOptionalStat(value: number | null) {
	return value === null ? "—" : String(value);
}

interface ScrimMapsSectionProps {
	maps: ScrimDetail["maps"];
	resultRevisions?: ScrimDetail["resultRevisions"];
}

export function ScrimMapsSection({ maps, resultRevisions = [] }: ScrimMapsSectionProps) {
	const latestRevision =
		resultRevisions.length > 0
			? resultRevisions.reduce((a, b) => (b.revisionNumber > a.revisionNumber ? b : a))
			: null;
	const scoreboardMapOrders = new Set(
		latestRevision?.snapshot.maps
			.filter((map) => !!map.scoreboardOcrJobId)
			.map((map) => map.mapOrder) ?? []
	);

	return (
		<section className="border p-4">
			<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Reviewed maps and stats
			</p>
			<div className="mt-4 space-y-3">
				{maps.length === 0 ? (
					<div className="border p-3">
						<p className="text-sm font-semibold">No reviewed map data saved yet</p>
						<p className="mt-1 text-xs text-muted-foreground">
							The series score exists, but per-map and per-player data has not been submitted yet.
						</p>
					</div>
				) : (
					maps.map((map) => {
						const hasScoreboardEvidence = scoreboardMapOrders.has(map.mapOrder);
						return (
							<div key={map.id} className="border p-3">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div>
										<p className="text-sm font-semibold">
											Map {map.mapOrder}: {map.mapName}
										</p>
										<p className="mt-1 text-xs text-muted-foreground">
											{map.mapType.replaceAll("_", " ")} · {map.homeScore}-{map.awayScore} ·{" "}
											{map.result}
											{map.durationSeconds !== null
												? ` · ${Math.round(map.durationSeconds / 60)}m`
												: ""}
										</p>
									</div>
									<div className="flex flex-wrap gap-1.5">
										<Badge variant="outline" className={STATUS_BADGE_CLASSES.completed}>
											Final map
										</Badge>
										{hasScoreboardEvidence ? (
											<Badge variant="outline" className={STATUS_BADGE_CLASSES.active}>
												Verified stats
											</Badge>
										) : map.players.length > 0 ? (
											<Badge variant="outline" className={STATUS_BADGE_CLASSES.open}>
												Player stats saved
											</Badge>
										) : (
											<Badge variant="outline" className={STATUS_BADGE_CLASSES.inactive}>
												No scoreboard attached
											</Badge>
										)}
									</div>
								</div>
								<p className="mt-2 text-xs text-muted-foreground">
									{hasScoreboardEvidence
										? `${map.players.length} player row(s) saved from scoreboard evidence.`
										: map.players.length > 0
											? `${map.players.length} player row(s) saved for this map.`
											: "Score-only map. Scoreboard evidence is optional and can be added in a later correction."}
								</p>

								{map.players.length > 0 ? (
									<div className="mt-3 space-y-2">
										{map.players.map((player) => (
											<div key={player.id} className="border p-2 text-xs">
												<div className="flex flex-wrap items-center justify-between gap-2">
													<p className="font-semibold">
														{player.playerName}
														<span className="ml-2 text-muted-foreground">
															{player.side}
															{player.hero ? ` · ${player.hero}` : ""}
															{player.role ? ` · ${player.role}` : ""}
														</span>
													</p>
													<p className="text-muted-foreground">
														E {formatOptionalStat(player.eliminations)} · A{" "}
														{formatOptionalStat(player.assists)} · D{" "}
														{formatOptionalStat(player.deaths)}
													</p>
												</div>
												<p className="mt-1 text-muted-foreground">
													DMG {formatOptionalStat(player.damage)} · HEAL{" "}
													{formatOptionalStat(player.healing)} · MIT{" "}
													{formatOptionalStat(player.mitigation)}
												</p>
											</div>
										))}
									</div>
								) : null}
							</div>
						);
					})
				)}
			</div>
		</section>
	);
}
