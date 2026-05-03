"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { removeOrgMemberAction, updateOrgMemberRoleAction } from "@/app/actions/org";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import type { OrgMemberSummary } from "@/lib/data/organization";
import { cn } from "@/lib/utils";

const ORG_ROLES = [
	{ value: "admin", label: "Admin" },
	{ value: "member", label: "Member" },
] as const;
const MEMBER_TYPES = [
	{ value: "player", label: "Player" },
	{ value: "staff", label: "Staff" },
] as const;
const GAME_ROLES = [
	{ value: "tank", label: "Tank" },
	{ value: "damage", label: "DPS" },
	{ value: "support", label: "Support" },
] as const;
const STAFF_ROLES = [
	{ value: "coach", label: "Coach" },
	{ value: "analyst", label: "Analyst" },
	{ value: "manager", label: "Manager" },
	{ value: "staff", label: "Staff" },
] as const;

type EditableRole = "admin" | "member";

interface MemberActionsDropdownProps {
	orgId: string;
	member: OrgMemberSummary;
	viewerRole: OrgMemberSummary["role"];
}

export function MemberActionsDropdown({ orgId, member, viewerRole }: MemberActionsDropdownProps) {
	const [editRoleOpen, setEditRoleOpen] = useState(false);
	const [removeOpen, setRemoveOpen] = useState(false);
	const [selectedRole, setSelectedRole] = useState<EditableRole>(
		(member.role as EditableRole) ?? "member"
	);
	const [memberType, setMemberType] = useState<"player" | "staff">(member.memberType);
	const [gameRole, setGameRole] = useState<"tank" | "damage" | "support">(
		member.gameRole ?? "damage"
	);
	const [staffRole, setStaffRole] = useState<"coach" | "analyst" | "manager" | "staff">(
		member.staffRole ?? "staff"
	);
	const editableRoles = ORG_ROLES.filter((role) =>
		viewerRole === "owner" ? true : role.value !== "admin"
	);

	const roleForm = useFormAction(updateOrgMemberRoleAction, {
		loadingMessage: "Updating role…",
		successMessage: "Role updated",
	});

	const removeForm = useFormAction(removeOrgMemberAction, {
		loadingMessage: "Removing member…",
		successMessage: "Member removed",
	});

	function submitRoleChange() {
		const fd = new FormData();
		fd.set("orgId", orgId);
		fd.set("memberId", member.id);
		fd.set("role", selectedRole);
		fd.set("memberType", memberType);
		if (memberType === "player") fd.set("gameRole", gameRole);
		if (memberType === "staff") fd.set("staffRole", staffRole);
		roleForm.submit(fd);
		setEditRoleOpen(false);
	}

	function submitRemove() {
		const fd = new FormData();
		fd.set("orgId", orgId);
		fd.set("memberId", member.id);
		removeForm.submit(fd);
		setRemoveOpen(false);
	}

	if (member.role === "owner") return null;
	if (viewerRole === "admin" && member.role === "admin") return null;

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button size="sm" variant="ghost" className="size-7 p-0">
						<HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
						<span className="sr-only">Open member actions</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-40">
					<DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={() => setEditRoleOpen(true)}>Edit role</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => setRemoveOpen(true)}
						className="text-destructive focus:text-destructive"
					>
						Remove
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Edit role — {member.displayName}</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-2 py-2">
						<p className="text-[11px] font-medium text-muted-foreground">Permission</p>
						{editableRoles.map((r) => (
							<button
								key={r.value}
								type="button"
								data-selected={selectedRole === r.value}
								onClick={() => setSelectedRole(r.value)}
								className={cn(
									"border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted",
									"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
								)}
							>
								{r.label}
							</button>
						))}
					</div>
					<div className="flex flex-col gap-2 py-2">
						<p className="text-[11px] font-medium text-muted-foreground">Member type</p>
						{MEMBER_TYPES.map((type) => (
							<button
								key={type.value}
								type="button"
								data-selected={memberType === type.value}
								onClick={() => setMemberType(type.value)}
								className={cn(
									"border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted",
									"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
								)}
							>
								{type.label}
							</button>
						))}
					</div>
					<div className="flex flex-col gap-2 py-2">
						<p className="text-[11px] font-medium text-muted-foreground">
							{memberType === "player" ? "Primary role" : "Staff role"}
						</p>
						{memberType === "player"
							? GAME_ROLES.map((role) => (
									<button
										key={role.value}
										type="button"
										data-selected={gameRole === role.value}
										onClick={() => setGameRole(role.value)}
										className={cn(
											"border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted",
											"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
										)}
									>
										{role.label}
									</button>
								))
							: STAFF_ROLES.map((role) => (
									<button
										key={role.value}
										type="button"
										data-selected={staffRole === role.value}
										onClick={() => setStaffRole(role.value)}
										className={cn(
											"border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted",
											"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
										)}
									>
										{role.label}
									</button>
								))}
					</div>
					<div className="flex gap-2">
						<Button size="sm" onClick={submitRoleChange} disabled={roleForm.isPending}>
							{roleForm.isPending && <Spinner className="mr-1.5" />}
							Save
						</Button>
						<Button size="sm" variant="outline" onClick={() => setEditRoleOpen(false)}>
							Cancel
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			<AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove {member.displayName}?</AlertDialogTitle>
						<AlertDialogDescription>
							They will be removed from the organization and marked inactive on all team rosters.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<Button
							variant="destructive"
							size="sm"
							onClick={submitRemove}
							disabled={removeForm.isPending}
						>
							{removeForm.isPending && <Spinner className="mr-1.5" />}
							Remove
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
