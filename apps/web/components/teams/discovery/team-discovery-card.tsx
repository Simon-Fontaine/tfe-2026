import { GameController01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import type { DiscoveryTeam } from "@/lib/data/discovery";
import { publicRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface TeamDiscoveryCardProps {
	team: DiscoveryTeam;
}

export function TeamDiscoveryCard({ team }: TeamDiscoveryCardProps) {
	return (
		<Link
			href={publicRoutes.teams.byId(team.id)}
			className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
		>
			<Avatar className="size-10 shrink-0 overflow-hidden rounded-none after:rounded-none">
				<AvatarImage src={team.avatarUrl ?? undefined} className="rounded-none" />
				<AvatarFallback className="rounded-none font-mono text-xs font-bold">
					{team.tag}
				</AvatarFallback>
			</Avatar>

			<div className="min-w-0 flex-1">
				<div className="flex items-baseline gap-2">
					<p className="truncate text-sm font-semibold">{team.name}</p>
					<span className="shrink-0 font-mono text-xs text-muted-foreground">[{team.tag}]</span>
				</div>
				<div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
					<span className="flex items-center gap-1">
						<HugeiconsIcon icon={GameController01Icon} strokeWidth={2} className="size-3" />
						Rating {team.rating}
					</span>
					<span className="flex items-center gap-1">
						<HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-3" />
						{team.activeRosterCount} member{team.activeRosterCount === 1 ? "" : "s"}
					</span>
				</div>
			</div>

			{team.isRecruiting && (
				<Badge
					variant="outline"
					className={cn("shrink-0 text-[10px]", STATUS_BADGE_CLASSES.recruiting)}
				>
					Recruiting
				</Badge>
			)}
		</Link>
	);
}
