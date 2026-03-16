"use client";

import { MoreHorizontalIcon, UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTransition } from "react";
import {
	removeRosterMemberAction,
	updateRosterStatusAction,
} from "@/app/dashboard/teams/[teamId]/actions/roster";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RosterMember, RosterStatus } from "@/lib/data/team";
import { cn } from "@/lib/utils";

const ROLE_LABELS = { tank: "Tank", damage: "DPS", support: "Support" } as const;

const STATUS_VARIANTS: Record<RosterStatus, string> = {
	active: "bg-green-500/10 text-green-600 border-0",
	benched: "bg-yellow-500/10 text-yellow-600 border-0",
	trial: "bg-blue-500/10 text-blue-600 border-0",
	inactive: "bg-muted text-muted-foreground border-0",
};

const RANK_LABELS: Record<string, string> = {
	bronze: "Bronze",
	silver: "Silver",
	gold: "Gold",
	platinum: "Platinum",
	diamond: "Diamond",
	master: "Master",
	grandmaster: "Grandmaster",
	champion: "Champion",
};

const STATUS_OPTIONS: { value: RosterStatus; label: string }[] = [
	{ value: "active", label: "Active" },
	{ value: "benched", label: "Benched" },
	{ value: "trial", label: "Trial" },
	{ value: "inactive", label: "Inactive" },
];

interface RosterRowProps {
	member: RosterMember;
	canManage: boolean;
}

function RosterRow({ member, canManage }: RosterRowProps) {
	const [isPending, startTransition] = useTransition();

	function changeStatus(status: RosterStatus) {
		const fd = new FormData();
		fd.set("rosterId", member.id);
		fd.set("status", status);
		startTransition(() => {
			void updateRosterStatusAction(null, fd);
		});
	}

	function remove() {
		const fd = new FormData();
		fd.set("rosterId", member.id);
		startTransition(() => {
			void removeRosterMemberAction(null, fd);
		});
	}

	return (
		<div
			className={cn(
				"flex items-center gap-3 px-4 py-3 transition-opacity",
				isPending && "opacity-50 pointer-events-none"
			)}
		>
			<Avatar className="size-8 rounded-none overflow-hidden after:rounded-none shrink-0">
				<AvatarImage src={member.avatarUrl ?? undefined} className="rounded-none" />
				<AvatarFallback className="rounded-none text-[10px]">
					<HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-3" />
				</AvatarFallback>
			</Avatar>

			<div className="min-w-0 flex-1">
				<p className="truncate text-xs font-medium">{member.displayName}</p>
				<p className="text-[10px] text-muted-foreground">
					{ROLE_LABELS[member.roleInTeam]}
					{member.rank &&
						` · ${RANK_LABELS[member.rank] ?? member.rank}${member.rankDivision ? ` ${member.rankDivision}` : ""}`}
				</p>
			</div>

			<Badge className={cn("text-[10px] shrink-0", STATUS_VARIANTS[member.status])}>
				{member.status.charAt(0).toUpperCase() + member.status.slice(1)}
			</Badge>

			{canManage && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						>
							<HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-40">
						<DropdownMenuLabel className="text-xs">Change status</DropdownMenuLabel>
						{STATUS_OPTIONS.filter((o) => o.value !== member.status).map((opt) => (
							<DropdownMenuItem
								key={opt.value}
								className="text-xs"
								onSelect={() => changeStatus(opt.value)}
							>
								{opt.label}
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-xs text-destructive focus:text-destructive"
							onSelect={remove}
						>
							Remove from team
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}

interface RosterTableProps {
	roster: RosterMember[];
	canManage: boolean;
	orgId: string;
	teamId: string;
}

export function RosterTable({ roster, canManage }: RosterTableProps) {
	const active = roster.filter((r) => r.status !== "inactive");
	const inactive = roster.filter((r) => r.status === "inactive");

	if (roster.length === 0) {
		return (
			<div className="flex items-center justify-center border border-dashed px-6 py-10 text-center">
				<p className="text-xs text-muted-foreground">
					No players yet. Add your first player to get started.
				</p>
			</div>
		);
	}

	return (
		<div className="border divide-y">
			{active.map((member) => (
				<RosterRow key={member.id} member={member} canManage={canManage} />
			))}

			{active.length > 0 && inactive.length > 0 && (
				<div className="px-4 py-2">
					<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
						Inactive
					</p>
				</div>
			)}

			{inactive.map((member) => (
				<RosterRow key={member.id} member={member} canManage={canManage} />
			))}
		</div>
	);
}
