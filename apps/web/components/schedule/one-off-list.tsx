"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AvailabilityRow } from "@/lib/data/player";
import { formatWindowTitle } from "@/lib/schedule/constants";
import { AddWindowDialog } from "./add-window-dialog";
import { DeleteButton } from "./delete-button";

interface OneOffListProps {
	oneOffs: AvailabilityRow[];
	teamId: string;
}

export function OneOffList({ oneOffs, teamId }: OneOffListProps) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Card>
				<CardHeader className="pb-3">
					<CardTitle>One-off dates</CardTitle>
					<CardAction>
						<Button
							variant="outline"
							size="sm"
							className="h-7 gap-1.5 px-2 text-xs"
							onClick={() => setOpen(true)}
						>
							<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3" />
							Add date
						</Button>
					</CardAction>
				</CardHeader>
				<CardContent>
					{oneOffs.length === 0 ? (
						<p className="text-xs text-muted-foreground">No one-off dates added yet.</p>
					) : (
						<div className="space-y-2">
							{oneOffs.map((row) => (
								<div key={row.id} className="flex items-center justify-between border px-3 py-2">
									<div className="min-w-0 flex-1">
										<p className="text-xs font-medium">
											{formatWindowTitle(row)}
											{row.label && (
												<span className="ml-1.5 text-muted-foreground">"{row.label}"</span>
											)}
										</p>
										<p className="text-[10px] text-muted-foreground">
											{row.startTime} – {row.endTime} · {row.timezone}
										</p>
									</div>
									<DeleteButton id={row.id} teamId={teamId} />
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<AddWindowDialog open={open} onOpenChange={setOpen} defaultType="one_off" teamId={teamId} />
		</>
	);
}
