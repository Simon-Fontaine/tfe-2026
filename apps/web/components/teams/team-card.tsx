import { GameController01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { OrgTeamSummary } from "@/lib/data/organization";
import { appRoutes } from "@/lib/routes";

interface TeamCardProps {
	team: OrgTeamSummary;
	orgId: string;
	href?: string;
}

export function TeamCard({ team, href, orgId: _orgId }: TeamCardProps) {
	return (
		<Link
			href={href ?? appRoutes.teams.byId(team.id)}
			className="flex items-center gap-3 border p-4 transition-colors hover:bg-muted/50"
		>
			<Avatar className="size-10 rounded-none overflow-hidden after:rounded-none shrink-0">
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
				<p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
					<HugeiconsIcon icon={GameController01Icon} strokeWidth={2} className="size-3" />
					Rating {team.rating}
				</p>
			</div>

			{team.isRecruiting && (
				<Badge variant="secondary" className="shrink-0 text-[10px] text-green-600">
					Recruiting
				</Badge>
			)}
		</Link>
	);
}
