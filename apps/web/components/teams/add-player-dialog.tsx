"use client";

import { useEffect, useRef, useState } from "react";
import { addPlayerAction } from "@/app/dashboard/teams/[teamId]/actions/roster";
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

interface AddPlayerDialogProps {
	teamId: string;
	orgId: string;
	children: React.ReactNode;
}

export function AddPlayerDialog({ teamId, orgId, children }: AddPlayerDialogProps) {
	const pendingRef = useRef(false);
	const [open, setOpen] = useState(false);
	const [roleInTeam, setRoleInTeam] = useState<"tank" | "damage" | "support">("damage");
	const [status, setStatus] = useState<"active" | "trial" | "benched">("active");
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
			if (user.primaryRole) setRoleInTeam(user.primaryRole);
		},
	});

	const { state, submit, isPending } = useFormAction(addPlayerAction, {
		loadingMessage: "Adding player…",
		successMessage: "Player added to roster",
	});

	useEffect(() => {
		if (state?.success && pendingRef.current) {
			pendingRef.current = false;
			setOpen(false);
		}
	}, [state]);

	function reset() {
		resetSearch();
		setRoleInTeam("damage");
		setStatus("active");
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!selected) return;
		pendingRef.current = true;
		const fd = new FormData();
		fd.set("teamId", teamId);
		fd.set("orgId", orgId);
		fd.set("userId", selected.id);
		fd.set("roleInTeam", roleInTeam);
		fd.set("status", status);
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
					<DialogTitle>Add player</DialogTitle>
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

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={!selected || isPending}>
							{isPending && <Spinner className="mr-1.5" />}
							Add to roster
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
