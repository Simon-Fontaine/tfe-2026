"use client";

import { appRoutes } from "@scrimflow/shared";
import Link from "next/link";
import type { AvailabilityRow, UserTeam } from "@/lib/data/player";
import { cn } from "@/lib/utils";
import { OneOffList } from "./one-off-list";
import { WeeklyGrid } from "./weekly-grid";

interface ScheduleGridProps {
	availability: AvailabilityRow[];
	teams: UserTeam[];
	activeTeam: UserTeam;
}

export function ScheduleGrid({ availability, teams, activeTeam }: ScheduleGridProps) {
	const recurring = availability.filter((r) => r.dayOfWeek !== null);
	const oneOffs = availability.filter((r) => r.specificDate !== null);

	return (
		<div className="space-y-8">
			{teams.length > 1 && (
				<div className="flex flex-wrap gap-1.5">
					{teams.map((team) => (
						<Link
							key={team.id}
							href={appRoutes.teams.calendar(team.id)}
							className={cn(
								"border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted",
								activeTeam.id === team.id
									? "border-primary bg-primary/10 text-primary"
									: "border-border text-muted-foreground"
							)}
						>
							{team.tag} · {team.name}
						</Link>
					))}
				</div>
			)}

			<div>
				<h2 className="mb-3 text-sm font-medium">Weekly availability</h2>
				<WeeklyGrid recurring={recurring} teamId={activeTeam.id} />
			</div>
			<OneOffList oneOffs={oneOffs} teamId={activeTeam.id} />
		</div>
	);
}
