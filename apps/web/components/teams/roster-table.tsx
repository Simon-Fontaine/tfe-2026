"use client";

import { MoreHorizontalIcon, UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTransition } from "react";
import {
	removeRosterMemberAction,
	updateRosterStatusAction,
	updateTeamMemberAction,
	updateTeamMemberPermissionAction,
} from "@/app/dashboard/workspace/orgs/actions/team";
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
const STAFF_ROLE_OPTIONS = [
	{ value: "coach", label: "Coach" },
	{ value: "analyst", label: "Analyst" },
	{ value: "manager", label: "Manager" },
	{ value: "staff", label: "Staff" },
] as const;

interface RosterRowProps {
	member: RosterMember;
	canManage: boolean;
	canManageAdmins: boolean;
	teamId: string;
}

function RosterRow({ member, canManage, canManageAdmins, teamId }: RosterRowProps) {
	const [isPending, startTransition] = useTransition();

	function changeStatus(status: RosterStatus) {
		const fd = new FormData();
		fd.set("teamId", teamId);
		fd.set("rosterId", member.id);
		fd.set("status", status);
		startTransition(() => {
			void updateRosterStatusAction(null, fd);
		});
	}

	function remove() {
		const fd = new FormData();
		fd.set("teamId", teamId);
		fd.set("rosterId", member.id);
		startTransition(() => {
			void removeRosterMemberAction(null, fd);
		});
	}

	function changePermissionRole(permissionRole: "admin" | "member") {
		const fd = new FormData();
		fd.set("teamId", teamId);
		fd.set("memberId", member.id);
		fd.set("permissionRole", permissionRole);
		startTransition(() => {
			void updateTeamMemberPermissionAction(null, fd);
		});
	}

	function updateMemberDetails(input: {
		memberType?: "player" | "staff";
		roleInTeam?: "tank" | "damage" | "support";
		staffRole?: "coach" | "analyst" | "manager" | "staff";
	}) {
		const fd = new FormData();
		fd.set("teamId", teamId);
		fd.set("memberId", member.id);
		if (input.memberType) fd.set("memberType", input.memberType);
		if (input.roleInTeam) fd.set("roleInTeam", input.roleInTeam);
		if (input.staffRole) fd.set("staffRole", input.staffRole);
		startTransition(() => {
			void updateTeamMemberAction(null, fd);
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
					{member.roleInTeam
						? ROLE_LABELS[member.roleInTeam]
						: member.staffRole
							? member.staffRole[0].toUpperCase() + member.staffRole.slice(1)
							: "Staff"}
					{member.rank &&
						` · ${RANK_LABELS[member.rank] ?? member.rank}${member.rankDivision ? ` ${member.rankDivision}` : ""}`}
				</p>
			</div>

			<Badge className={cn("text-[10px] shrink-0", STATUS_VARIANTS[member.status])}>
				{member.status.charAt(0).toUpperCase() + member.status.slice(1)}
			</Badge>
			{member.permissionRole === "admin" && (
				<Badge variant="outline" className="text-[10px] shrink-0">
					Admin
				</Badge>
			)}

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
						<DropdownMenuLabel className="text-xs">Member type</DropdownMenuLabel>
						<DropdownMenuItem
							className="text-xs"
							onSelect={() =>
								updateMemberDetails({
									memberType: member.memberType === "player" ? "staff" : "player",
									roleInTeam: member.memberType === "staff" ? "damage" : undefined,
									staffRole: member.memberType === "player" ? "staff" : undefined,
								})
							}
						>
							{member.memberType === "player" ? "Convert to staff" : "Convert to player"}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuLabel className="text-xs">
							{member.memberType === "player" ? "Game role" : "Staff role"}
						</DropdownMenuLabel>
						{member.memberType === "player"
							? (Object.entries(ROLE_LABELS) as Array<["tank" | "damage" | "support", string]>)
									.filter(([role]) => role !== member.roleInTeam)
									.map(([role, label]) => (
										<DropdownMenuItem
											key={role}
											className="text-xs"
											onSelect={() => updateMemberDetails({ roleInTeam: role })}
										>
											{label}
										</DropdownMenuItem>
									))
							: STAFF_ROLE_OPTIONS.filter((option) => option.value !== member.staffRole).map(
									(option) => (
										<DropdownMenuItem
											key={option.value}
											className="text-xs"
											onSelect={() => updateMemberDetails({ staffRole: option.value })}
										>
											{option.label}
										</DropdownMenuItem>
									)
								)}
						<DropdownMenuSeparator />
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
						{canManageAdmins && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-xs"
									onSelect={() =>
										changePermissionRole(member.permissionRole === "admin" ? "member" : "admin")
									}
								>
									{member.permissionRole === "admin" ? "Remove admin" : "Make admin"}
								</DropdownMenuItem>
							</>
						)}
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
	canManageAdmins?: boolean;
	teamId: string;
	emptyLabel?: string;
}

export function RosterTable({
	roster,
	canManage,
	canManageAdmins = false,
	teamId,
	emptyLabel = "No members yet. Add your first member to get started.",
}: RosterTableProps) {
	const active = roster.filter((r) => r.status !== "inactive");
	const inactive = roster.filter((r) => r.status === "inactive");

	if (roster.length === 0) {
		return (
			<div className="flex items-center justify-center border border-dashed px-6 py-10 text-center">
				<p className="text-xs text-muted-foreground">{emptyLabel}</p>
			</div>
		);
	}

	return (
		<div className="border divide-y">
			{active.map((member) => (
				<RosterRow
					key={member.id}
					member={member}
					canManage={canManage}
					canManageAdmins={canManageAdmins}
					teamId={teamId}
				/>
			))}

			{active.length > 0 && inactive.length > 0 && (
				<div className="px-4 py-2">
					<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
						Inactive
					</p>
				</div>
			)}

			{inactive.map((member) => (
				<RosterRow
					key={member.id}
					member={member}
					canManage={canManage}
					canManageAdmins={canManageAdmins}
					teamId={teamId}
				/>
			))}
		</div>
	);
}
