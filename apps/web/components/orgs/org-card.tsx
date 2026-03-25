import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { UserOrg } from "@/lib/data/organization";

const ROLE_LABELS: Record<string, string> = {
	owner: "Owner",
	manager: "Manager",
	coach: "Coach",
	analyst: "Analyst",
	player: "Player",
};

interface OrgCardProps {
	org: UserOrg;
}

export function OrgCard({ org }: OrgCardProps) {
	return (
		<Link
			href={`/dashboard/workspace/orgs/${org.id}`}
			className="flex items-center gap-3 border p-4 transition-colors hover:bg-muted/50"
		>
			<Avatar className="size-10 rounded-none overflow-hidden after:rounded-none shrink-0">
				<AvatarImage src={org.avatarUrl ?? undefined} className="rounded-none" />
				<AvatarFallback className="rounded-none text-xs font-bold">
					{org.name.substring(0, 2).toUpperCase()}
				</AvatarFallback>
			</Avatar>

			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<p className="truncate text-sm font-semibold">{org.name}</p>
					<Badge variant="secondary" className="shrink-0 text-[10px]">
						{ROLE_LABELS[org.role] ?? org.role}
					</Badge>
				</div>
				<div className="flex items-center gap-3 mt-0.5">
					<p className="text-xs text-muted-foreground">/{org.slug}</p>
					<span className="text-xs text-muted-foreground flex items-center gap-1">
						<HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-3" />
						{org.teamCount} team{org.teamCount === 1 ? "" : "s"}
					</span>
				</div>
				{org.description && (
					<p className="mt-1 truncate text-xs text-muted-foreground">{org.description}</p>
				)}
			</div>
		</Link>
	);
}
