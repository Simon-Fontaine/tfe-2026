import { UserGroup02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function ScheduleNoTeams() {
	return (
		<div className="flex flex-col items-center justify-center py-20 text-center">
			<HugeiconsIcon
				icon={UserGroup02Icon}
				strokeWidth={1.5}
				className="mb-4 size-10 text-muted-foreground/40"
			/>
			<h2 className="mb-1 text-sm font-medium">No active teams</h2>
			<p className="mb-6 max-w-xs text-xs text-muted-foreground">
				You're not currently an active member of any team. Join or create a team to set your
				availability.
			</p>
			<Button asChild size="sm" variant="outline">
				<Link href="/dashboard/orgs">Browse organizations</Link>
			</Button>
		</div>
	);
}
