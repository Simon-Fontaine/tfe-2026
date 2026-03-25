"use client";

import { useEffect, useRef, useState } from "react";
import { inviteToOrgAction } from "@/app/dashboard/orgs/actions/org";
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

const ORG_ROLES = [
	{ value: "manager", label: "Manager" },
	{ value: "coach", label: "Coach" },
	{ value: "analyst", label: "Analyst" },
	{ value: "player", label: "Player" },
] as const;

type OrgRole = (typeof ORG_ROLES)[number]["value"];

const ROLE_LABELS = { tank: "Tank", damage: "DPS", support: "Support" } as const;
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

interface InviteMemberDialogProps {
	orgId: string;
	children: React.ReactNode;
}

export function InviteMemberDialog({ orgId, children }: InviteMemberDialogProps) {
	const [open, setOpen] = useState(false);
	const [role, setRole] = useState<OrgRole>("player");
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
		setRole("player");
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!selected) return;
		pendingRef.current = true;
		const fd = new FormData();
		fd.set("orgId", orgId);
		fd.set("userId", selected.id);
		fd.set("role", role);
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
						renderUserMeta={(u) =>
							u.primaryRole || u.rank ? (
								<>
									{u.primaryRole && ROLE_LABELS[u.primaryRole as keyof typeof ROLE_LABELS]}
									{u.rank && ` · ${RANK_LABELS[u.rank] ?? u.rank}`}
								</>
							) : null
						}
					/>

					<Field>
						<FieldLabel>Role in organisation</FieldLabel>
						<div className="flex flex-wrap gap-2">
							{ORG_ROLES.map((r) => (
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
