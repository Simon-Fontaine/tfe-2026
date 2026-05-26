import type { TeamSchedule } from "@scrimflow/shared";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatWindow(row: TeamSchedule["availability"][number]) {
	const time = `${row.startTime}–${row.endTime}`;
	if (row.dayOfWeek !== null) {
		return `${DAYS[row.dayOfWeek]} ${time} · ${row.timezone}`;
	}
	return `${row.specificDate ?? "Date"} ${time} · ${row.timezone}`;
}

export function TeamScheduleBoard({
	schedule,
	currentUserId,
}: {
	schedule: TeamSchedule;
	currentUserId: string;
}) {
	const byUser = new Map<string, TeamSchedule["availability"]>();
	for (const row of schedule.availability) {
		const existing = byUser.get(row.userId) ?? [];
		existing.push(row);
		byUser.set(row.userId, existing);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{schedule.teamName} · Team schedule</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{schedule.members.map((member) => {
					const windows = byUser.get(member.userId) ?? [];
					return (
						<div key={member.userId} className="border p-3">
							<div className="mb-2 flex items-center gap-3">
								<Avatar className="size-7 overflow-hidden rounded-none after:rounded-none">
									<AvatarImage src={member.avatarUrl ?? undefined} className="rounded-none" />
									<AvatarFallback className="rounded-none text-[10px]">
										{member.displayName.slice(0, 2).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<div className="min-w-0 flex-1">
									<p className="truncate text-xs font-medium">
										{member.displayName}
										{member.userId === currentUserId ? " (You)" : ""}
									</p>
									<p className="text-[11px] text-muted-foreground capitalize">
										{member.memberType}
									</p>
								</div>
							</div>
							{member.availabilityHidden ? (
								<p className="text-xs italic text-muted-foreground">Availability set to private.</p>
							) : windows.length === 0 ? (
								<p className="text-xs text-muted-foreground">No availability submitted yet.</p>
							) : (
								<div className="flex flex-wrap gap-1.5">
									{windows.map((row) => (
										<Badge key={row.id} variant="outline" className="text-[10px]">
											{formatWindow(row)}
										</Badge>
									))}
								</div>
							)}
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
