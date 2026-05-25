"use client";

import { useEffect, useRef, useState } from "react";
import { inviteToOrgAction } from "@/app/actions/org";
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

const ORG_PERMISSION_ROLES = [
	{ value: "admin", label: "Admin" },
	{ value: "member", label: "Member" },
] as const;
const MEMBER_TYPES = [
	{ value: "player", label: "Player" },
	{ value: "staff", label: "Staff" },
] as const;
const OW2_ROLES = [
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

type OrgRole = (typeof ORG_PERMISSION_ROLES)[number]["value"];

interface InviteMemberDialogProps {
	orgId: string;
	children: React.ReactNode;
}

export function InviteMemberDialog({ orgId, children }: InviteMemberDialogProps) {
	const [open, setOpen] = useState(false);
	const [role, setRole] = useState<OrgRole>("member");
	const [memberType, setMemberType] = useState<"player" | "staff">("player");
	const [gameRole, setGameRole] = useState<"tank" | "damage" | "support">("damage");
	const [staffRole, setStaffRole] = useState<"coach" | "analyst" | "manager" | "staff">("staff");
	const pendingRef = useRef(false);
	const {
		query,
		results,
		searching,
		selected,
		updateQuery,
		selectUser,
		clearSelection,
		reset: resetSearch,
	} = useUserSearch({});

	const { state, submit, isPending } = useFormAction(inviteToOrgAction, {
		loadingMessage: "Sending invite…",
		successMessage: "Invite sent",
	});

	useEffect(() => {
		if (state?.success && pendingRef.current) {
			pendingRef.current = false;
			setOpen(false);
		}
	}, [state]);

	function reset() {
		resetSearch();
		setRole("member");
		setMemberType("player");
		setGameRole("damage");
		setStaffRole("staff");
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!selected) return;
		pendingRef.current = true;
		const fd = new FormData();
		fd.set("orgId", orgId);
		fd.set("userId", selected.id);
		fd.set("role", role);
		fd.set("memberType", memberType);
		if (memberType === "player") fd.set("gameRole", gameRole);
		if (memberType === "staff") fd.set("staffRole", staffRole);
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
					<DialogTitle>Invite member</DialogTitle>
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
					{state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
					{state?.fieldErrors ? (
						<div className="space-y-1 text-xs text-destructive">
							{Object.entries(state.fieldErrors).map(([field, messages]) => (
								<p key={field}>
									{field}: {messages?.join(", ")}
								</p>
							))}
						</div>
					) : null}

					<Field>
						<FieldLabel>Permission</FieldLabel>
						<div className="flex flex-wrap gap-2">
							{ORG_PERMISSION_ROLES.map((r) => (
								<button
									key={r.value}
									type="button"
									data-selected={role === r.value}
									onClick={() => setRole(r.value)}
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

					<Field>
						<FieldLabel>Member type</FieldLabel>
						<div className="flex flex-wrap gap-2">
							{MEMBER_TYPES.map((type) => (
								<button
									key={type.value}
									type="button"
									data-selected={memberType === type.value}
									onClick={() => setMemberType(type.value)}
									className={cn(
										"flex-1 border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted",
										"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
										"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
									)}
								>
									{type.label}
								</button>
							))}
						</div>
					</Field>

					{memberType === "player" ? (
						<Field>
							<FieldLabel>Primary role</FieldLabel>
							<div className="flex gap-2">
								{OW2_ROLES.map((option) => (
									<button
										key={option.value}
										type="button"
										data-selected={gameRole === option.value}
										onClick={() => setGameRole(option.value)}
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
					) : (
						<Field>
							<FieldLabel>Staff role</FieldLabel>
							<div className="grid gap-2 sm:grid-cols-2">
								{STAFF_ROLES.map((option) => (
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

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={!selected || isPending}>
							{isPending && <Spinner className="mr-1.5" />}
							Send invite
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
