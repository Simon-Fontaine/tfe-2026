"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AvailabilityRow } from "@/lib/data/player";
import { DAYS } from "@/lib/schedule/constants";
import { AddWindowDialog } from "./add-window-dialog";
import { DeleteButton } from "./delete-button";

interface WeeklyGridProps {
	recurring: AvailabilityRow[];
	teamId: string;
}

export function WeeklyGrid({ recurring, teamId }: WeeklyGridProps) {
	const [dialogState, setDialogState] = useState<{ open: boolean; day: number | null }>({
		open: false,
		day: null,
	});

	return (
		<>
			<div className="overflow-x-auto">
				<div className="grid min-w-[560px] grid-cols-7 gap-px border bg-border">
					{DAYS.map((day) => {
						const windows = recurring.filter((r) => r.dayOfWeek === day.value);
						return (
							<div key={day.value} className="flex flex-col bg-card">
								{/* Column header */}
								<div className="border-b px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
									{day.label}
								</div>

								{/* Time blocks */}
								<div className="flex min-h-24 flex-1 flex-col gap-1 p-1.5">
									{windows.map((row) => (
										<div key={row.id} className="group relative border bg-muted/40 px-2 py-1.5">
											<p className="pr-5 text-[10px] font-medium leading-tight">
												{row.startTime}–{row.endTime}
											</p>
											<p className="text-[10px] leading-tight text-muted-foreground">
												{row.timezone}
											</p>
											{row.label && (
												<Badge variant="outline" className="mt-1 h-4 text-[9px]">
													{row.label}
												</Badge>
											)}
											<div className="absolute right-0.5 top-0.5 opacity-0 transition-opacity group-hover:opacity-100">
												<DeleteButton id={row.id} teamId={teamId} />
											</div>
										</div>
									))}
								</div>

								{/* Add button */}
								<div className="border-t p-1">
									<Button
										variant="ghost"
										size="sm"
										className="h-6 w-full gap-1 text-[10px] text-muted-foreground"
										onClick={() => setDialogState({ open: true, day: day.value })}
									>
										<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3" />
										Add
									</Button>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			<AddWindowDialog
				open={dialogState.open}
				onOpenChange={(open) => setDialogState((s) => ({ ...s, open }))}
				defaultType="recurring"
				defaultDay={dialogState.day}
				teamId={teamId}
			/>
		</>
	);
}
