"use client";

import { MoreHorizontalIcon, UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
	removeRosterMemberAction,
	updateRosterStatusAction,
	updateTeamMemberAction,
	updateTeamMemberPermissionAction,
} from "@/app/actions/team";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import type { RosterMember, RosterStatus } from "@/lib/data/team";
import { publicRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const ROLE_LABELS = { tank: "Tank", damage: "DPS", support: "Support" } as const;

const STATUS_VARIANTS: Record<RosterStatus, string> = {
	active: STATUS_BADGE_CLASSES.rosterActive,
	benched: STATUS_BADGE_CLASSES.rosterBenched,
	trial: STATUS_BADGE_CLASSES.rosterTrial,
	inactive: STATUS_BADGE_CLASSES.rosterInactive,
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
	const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
	const [mutationError, setMutationError] = useState<string | null>(null);

	function submitMutation(action: () => Promise<{ error?: string; fieldErrors?: unknown }>) {
		setMutationError(null);
		startTransition(async () => {
			const result = await action();
			if (result.error) {
				setMutationError(result.error);
				return;
			}
			if (result.fieldErrors) {
				setMutationError("Check the selected roster fields and try again.");
			}
		});
	}

	function changeStatus(status: RosterStatus) {
		const fd = new FormData();
		fd.set("teamId", teamId);
		fd.set("rosterId", member.id);
		fd.set("status", status);
		submitMutation(() => updateRosterStatusAction(null, fd));
	}

	function remove() {
		const fd = new FormData();
		fd.set("teamId", teamId);
		fd.set("rosterId", member.id);
		submitMutation(() => removeRosterMemberAction(null, fd));
	}

	function changePermissionRole(permissionRole: "admin" | "member") {
		const fd = new FormData();
		fd.set("teamId", teamId);
		fd.set("memberId", member.id);
		fd.set("permissionRole", permissionRole);
		submitMutation(() => updateTeamMemberPermissionAction(null, fd));
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
		submitMutation(() => updateTeamMemberAction(null, fd));
	}

	return (
		<div className={cn("transition-opacity", isPending && "opacity-50 pointer-events-none")}>
			<div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					<Avatar className="size-8 shrink-0 overflow-hidden rounded-none after:rounded-none">
						<AvatarImage src={member.avatarUrl ?? undefined} className="rounded-none" />
						<AvatarFallback className="rounded-none text-[10px]">
							<HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-3" />
						</AvatarFallback>
					</Avatar>

					<div className="min-w-0 flex-1">
						<Link
							href={publicRoutes.players.byUsername(member.username)}
							className="block truncate text-xs font-medium hover:underline"
						>
							{member.displayName}
						</Link>
						<p className="truncate text-[10px] text-muted-foreground">
							{member.roleInTeam
								? ROLE_LABELS[member.roleInTeam]
								: member.staffRole
									? member.staffRole[0].toUpperCase() + member.staffRole.slice(1)
									: "Staff"}
							{member.rank &&
								` · ${RANK_LABELS[member.rank] ?? member.rank}${member.rankDivision ? ` ${member.rankDivision}` : ""}`}
						</p>
						{member.mainHero && (
							<div className="mt-1 flex items-center gap-1.5">
								{member.mainHero.imageUrl && (
									<div className="relative size-5 shrink-0 overflow-hidden">
										<Image
											src={member.mainHero.imageUrl}
											alt=""
											fill
											sizes="20px"
											unoptimized
											className="object-cover object-top"
										/>
									</div>
								)}
								<span className="truncate text-[10px] text-muted-foreground">
									{member.mainHero.displayName}
								</span>
							</div>
						)}
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
					<Badge
						variant="outline"
						className={cn("min-w-16 justify-center text-[10px]", STATUS_VARIANTS[member.status])}
					>
						{member.status.charAt(0).toUpperCase() + member.status.slice(1)}
					</Badge>
					<Badge variant="outline" className="min-w-24 justify-center text-[10px]">
						{member.permissionRole === "admin" ? "Admin access" : "Member access"}
					</Badge>

					{canManage && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									aria-label={`Manage ${member.displayName}`}
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
									onSelect={() => setRemoveDialogOpen(true)}
								>
									Remove from team
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
			</div>

			{mutationError ? (
				<div className="px-4 pb-3">
					<Alert variant="destructive">
						<AlertDescription>{mutationError}</AlertDescription>
					</Alert>
				</div>
			) : null}

			{canManage && (
				<AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Remove {member.displayName}?</AlertDialogTitle>
							<AlertDialogDescription>
								This removes team-scoped access while preserving historical roster context.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction onClick={remove}>Remove member</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}
		</div>
	);
}

interface RosterTableProps {
	roster: RosterMember[];
	canManage: boolean;
	canManageAdmins?: boolean;
	teamId: string;
}

export function RosterTable({
	roster,
	canManage,
	canManageAdmins = false,
	teamId,
}: RosterTableProps) {
	const active = roster.filter((r) => r.status !== "inactive");
	const inactive = roster.filter((r) => r.status === "inactive");

	if (roster.length === 0) {
		return (
			<div className="border divide-y">
				<div className="py-8 text-center text-sm text-muted-foreground">No roster members yet.</div>
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
