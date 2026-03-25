"use client";

import { useEffect, useRef, useState } from "react";
import { addPlayerAction } from "@/app/dashboard/workspace/orgs/actions/team";
import { renderOw2RoleRankMeta } from "@/components/shared/user-search-meta";
import { UserSearchPicker } from "@/components/shared/user-search-picker";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import { useUserSearch } from "@/hooks/use-user-search";
import { cn } from "@/lib/utils";

const OW2_ROLES = [
	{ value: "tank", label: "Tank" },
	{ value: "damage", label: "DPS" },
	{ value: "support", label: "Support" },
] as const;

const ROSTER_STATUSES = [
	{ value: "active", label: "Active" },
	{ value: "trial", label: "Trial" },
	{ value: "benched", label: "Benched" },
] as const;

const TEAM_PERMISSION_OPTIONS = [
	{ value: "member", label: "Member access" },
	{ value: "admin", label: "Admin access" },
] as const;
const STAFF_ROLE_OPTIONS = [
	{ value: "coach", label: "Coach" },
	{ value: "analyst", label: "Analyst" },
	{ value: "manager", label: "Manager" },
	{ value: "staff", label: "Staff" },
] as const;

type TeamPermissionRole = (typeof TEAM_PERMISSION_OPTIONS)[number]["value"];
type MemberType = "player" | "staff";

interface AddPlayerDialogProps {
	teamId: string;
	canManageAdmins?: boolean;
	defaultMemberType?: MemberType;
	title?: string;
	submitLabel?: string;
	children: React.ReactNode;
}

export function AddPlayerDialog({
	teamId,
	canManageAdmins = false,
	defaultMemberType = "player",
	title = "Add member",
	submitLabel = "Add to roster",
	children,
}: AddPlayerDialogProps) {
	const pendingRef = useRef(false);
	const [open, setOpen] = useState(false);
	const [memberType, setMemberType] = useState<MemberType>(defaultMemberType);
	const [roleInTeam, setRoleInTeam] = useState<"tank" | "damage" | "support">("damage");
	const [staffRole, setStaffRole] = useState<"coach" | "analyst" | "manager" | "staff">("staff");
	const [status, setStatus] = useState<"active" | "trial" | "benched">("active");
	const [permissionRole, setPermissionRole] = useState<TeamPermissionRole>("member");
	const {
		query,
		results,
		searching,
		selected,
		updateQuery,
		selectUser,
		clearSelection,
		reset: resetSearch,
	} = useUserSearch({
		excludeTeamId: teamId,
		prefillFromSelection: (user) => {
			if (defaultMemberType === "player" && user.primaryRole) setRoleInTeam(user.primaryRole);
		},
	});

	const { state, submit, isPending } = useFormAction(addPlayerAction, {
		loadingMessage: "Adding member…",
		successMessage: "Member added to team",
	});

	useEffect(() => {
		if (state?.success && pendingRef.current) {
			pendingRef.current = false;
			setOpen(false);
		}
	}, [state]);

	function reset() {
		resetSearch();
		setMemberType(defaultMemberType);
		setRoleInTeam("damage");
		setStaffRole("staff");
		setStatus("active");
		setPermissionRole("member");
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!selected) return;
		pendingRef.current = true;
		const fd = new FormData();
		fd.set("teamId", teamId);
		fd.set("userId", selected.id);
		fd.set("memberType", memberType);
		if (memberType === "player") fd.set("roleInTeam", roleInTeam);
		if (memberType === "staff") fd.set("staffRole", staffRole);
		fd.set("status", status);
		if (canManageAdmins) fd.set("permissionRole", permissionRole);
		submit(fd);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				setOpen(o);
				if (!o) reset();
			}}
		>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<UserSearchPicker
						label="Search by display name"
						placeholder="e.g. Hestia"
						query={query}
						searching={searching}
						results={results}
						selected={selected}
						onQueryChange={updateQuery}
						onSelect={selectUser}
						onClearSelection={clearSelection}
						renderUserMeta={renderOw2RoleRankMeta}
					/>

					<Field>
						<FieldLabel>Member type</FieldLabel>
						<div className="flex gap-2">
							{(["player", "staff"] as const).map((option) => (
								<button
									key={option}
									type="button"
									data-selected={memberType === option}
									onClick={() => setMemberType(option)}
									className={cn(
										"flex-1 border border-border px-3 py-2 text-xs font-medium capitalize transition-colors hover:bg-muted",
										"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
										"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
									)}
								>
									{option}
								</button>
							))}
						</div>
					</Field>

					{memberType === "player" ? (
						<Field>
							<FieldLabel>Role on team</FieldLabel>
							<div className="flex gap-2">
								{OW2_ROLES.map((r) => (
									<button
										key={r.value}
										type="button"
										data-selected={roleInTeam === r.value}
										onClick={() => setRoleInTeam(r.value)}
										className={cn(
											"flex-1 border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
											"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
										)}
									>
										{r.label}
									</button>
								))}
							</div>
						</Field>
					) : (
						<Field>
							<FieldLabel>Staff role</FieldLabel>
							<div className="grid gap-2 sm:grid-cols-2">
								{STAFF_ROLE_OPTIONS.map((option) => (
									<button
										key={option.value}
										type="button"
										data-selected={staffRole === option.value}
										onClick={() => setStaffRole(option.value)}
										className={cn(
											"border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
											"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
										)}
									>
										{option.label}
									</button>
								))}
							</div>
						</Field>
					)}

					<Field>
						<FieldLabel>Roster status</FieldLabel>
						<div className="flex gap-2">
							{ROSTER_STATUSES.map((s) => (
								<button
									key={s.value}
									type="button"
									data-selected={status === s.value}
									onClick={() => setStatus(s.value)}
									className={cn(
										"flex-1 border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted",
										"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
										"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
									)}
								>
									{s.label}
								</button>
							))}
						</div>
					</Field>

					{canManageAdmins && (
						<Field>
							<FieldLabel>Access level</FieldLabel>
							<div className="flex gap-2">
								{TEAM_PERMISSION_OPTIONS.map((option) => (
									<button
										key={option.value}
										type="button"
										data-selected={permissionRole === option.value}
										onClick={() => setPermissionRole(option.value)}
										className={cn(
											"flex-1 border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
											"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
										)}
									>
										{option.label}
									</button>
								))}
							</div>
						</Field>
					)}

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={!selected || isPending}>
							{isPending && <Spinner className="mr-1.5" />}
							{submitLabel}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setOpen(false)}
							disabled={isPending}
						>
							Cancel
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
