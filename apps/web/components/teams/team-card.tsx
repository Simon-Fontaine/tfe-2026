import {
	AlertCircleIcon,
	ArrowRight01Icon,
	Calendar03Icon,
	GameController01Icon,
	UserGroupIcon,
} from "@hugeicons/core-free-icons";
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

function formatSignalCount(count: number | null) {
	return count === null ? "" : ` ${count}`;
}

const SIGNAL_SEVERITY_RANK = {
	critical: 0,
	warning: 1,
	info: 2,
};

export function TeamCard({ team, href, orgId: _orgId }: TeamCardProps) {
	const targetHref = href ?? appRoutes.teams.byId(team.id);
	const oversight = team.oversight;
	const canOpenWorkspace = oversight?.canOpenWorkspace ?? true;
	const relationshipLabel = oversight?.relationshipState === "archived" ? "Archived" : "Active";
	const visibilityLabel = oversight?.visibility === "private" ? "Private" : "Public";
	const topSignals =
		oversight?.signals
			.toSorted((a, b) => SIGNAL_SEVERITY_RANK[a.severity] - SIGNAL_SEVERITY_RANK[b.severity])
			.slice(0, 3) ?? [];

	const content = (
		<>
			<Avatar className="size-10 rounded-none overflow-hidden after:rounded-none shrink-0">
				<AvatarImage src={team.avatarUrl ?? undefined} className="rounded-none" />
				<AvatarFallback className="rounded-none font-mono text-xs font-bold">
					{team.tag}
				</AvatarFallback>
			</Avatar>

			<div className="min-w-0 flex-1 space-y-3">
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<p className="truncate text-sm font-semibold">{team.name}</p>
					<span className="font-mono text-xs text-muted-foreground">[{team.tag}]</span>
					<Badge variant="outline" className="text-[10px]">
						{relationshipLabel}
					</Badge>
					<Badge variant="secondary" className="text-[10px]">
						{visibilityLabel}
					</Badge>
				</div>

				<div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
					<p className="flex items-center gap-1">
						<HugeiconsIcon icon={GameController01Icon} strokeWidth={2} className="size-3.5" />
						Rating {team.rating}
					</p>
					<p className="flex items-center gap-1">
						<HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-3.5" />
						{oversight?.activeRosterCount ?? team.activeRosterCount} active roster
					</p>
					<p className="flex items-center gap-1">
						<HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
						{oversight?.upcomingScrimCount ?? 0} upcoming scrims
					</p>
				</div>

				{topSignals.length > 0 ? (
					<div className="flex flex-wrap gap-1.5">
						{topSignals.map((signal) => (
							<Badge key={signal.code} variant="outline" className="text-[10px]">
								{signal.label}
								{formatSignalCount(signal.count)}
							</Badge>
						))}
					</div>
				) : null}

				{oversight ? (
					<p className="text-[11px] text-muted-foreground">{oversight.autonomyCopy}</p>
				) : null}
			</div>

			{canOpenWorkspace ? (
				<HugeiconsIcon
					icon={ArrowRight01Icon}
					strokeWidth={2}
					className="hidden size-4 shrink-0 text-muted-foreground sm:block"
				/>
			) : (
				<div className="hidden shrink-0 items-center gap-1 text-[11px] text-muted-foreground sm:flex">
					<HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-3.5" />
					Summary only
				</div>
			)}
		</>
	);

	if (!canOpenWorkspace) {
		return <div className="flex items-start gap-3 border p-4">{content}</div>;
	}

	return (
		<Link
			href={targetHref}
			prefetch={false}
			className="flex items-start gap-3 border p-4 transition-colors hover:bg-muted/50"
		>
			{content}
		</Link>
	);
}
