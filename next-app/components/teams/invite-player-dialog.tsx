"use client";

import { Search01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { sendTeamInviteAction } from "@/app/dashboard/teams/[teamId]/actions/invites";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import type { UserSearchResult } from "@/lib/data/team";
import { cn } from "@/lib/utils";

const OW2_ROLES = [
	{ value: "tank", label: "Tank" },
	{ value: "damage", label: "DPS" },
	{ value: "support", label: "Support" },
] as const;

type OW2Role = (typeof OW2_ROLES)[number]["value"];

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

interface InvitePlayerDialogProps {
	teamId: string;
	orgId: string;
	children: React.ReactNode;
}

export function InvitePlayerDialog({ teamId, orgId, children }: InvitePlayerDialogProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<UserSearchResult[]>([]);
	const [searching, setSearching] = useState(false);
	const [selected, setSelected] = useState<UserSearchResult | null>(null);
	const [roleInTeam, setRoleInTeam] = useState<OW2Role>("damage");
	const pendingRef = useRef(false);

	const { state, submit, isPending } = useFormAction(sendTeamInviteAction, {
		loadingMessage: "Sending invite…",
		successMessage: "Invite sent",
	});

	useEffect(() => {
		if (query.length < 2) {
			setResults([]);
			return;
		}
		setSearching(true);
		const timer = setTimeout(async () => {
			try {
				const res = await fetch(
					`/api/users/search?q=${encodeURIComponent(query)}&excludeTeamId=${teamId}`
				);
				const data = await res.json();
				setResults(data.users ?? []);
			} finally {
				setSearching(false);
			}
		}, 300);
		return () => clearTimeout(timer);
	}, [query, teamId]);

	useEffect(() => {
		if (state?.success && pendingRef.current) {
			pendingRef.current = false;
			setOpen(false);
		}
	}, [state]);

	function reset() {
		setQuery("");
		setResults([]);
		setSelected(null);
		setRoleInTeam("damage");
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
					<DialogTitle>Invite player</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<Field>
						<FieldLabel>Search by display name</FieldLabel>
						<div className="relative">
							<HugeiconsIcon
								icon={Search01Icon}
								strokeWidth={2}
								className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								placeholder="e.g. Hestia"
								value={query}
								onChange={(e) => {
									setQuery(e.target.value);
									setSelected(null);
								}}
								className="pl-8"
							/>
							{searching && (
								<Spinner className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2" />
							)}
						</div>
					</Field>

					{results.length > 0 && !selected && (
						<div className="max-h-48 divide-y overflow-y-auto border">
							{results.map((u) => (
								<button
									key={u.id}
									type="button"
									onClick={() => {
										setSelected(u);
										setResults([]);
										if (u.primaryRole) setRoleInTeam(u.primaryRole);
									}}
									className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted"
								>
									<Avatar className="size-7 shrink-0 overflow-hidden rounded-none after:rounded-none">
										<AvatarImage src={u.avatarUrl ?? undefined} className="rounded-none" />
										<AvatarFallback className="rounded-none text-[10px]">
											<HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-3" />
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0">
										<p className="truncate text-xs font-medium">{u.displayName}</p>
										{(u.primaryRole || u.rank) && (
											<p className="text-[10px] text-muted-foreground">
												{u.primaryRole && ROLE_LABELS[u.primaryRole as keyof typeof ROLE_LABELS]}
												{u.rank && ` · ${RANK_LABELS[u.rank] ?? u.rank}`}
											</p>
										)}
									</div>
								</button>
							))}
						</div>
					)}

					{query.length >= 2 && !searching && results.length === 0 && !selected && (
						<p className="text-xs text-muted-foreground">No users found matching "{query}".</p>
					)}

					{selected && (
						<div className="flex items-center gap-3 border bg-muted/40 px-3 py-2">
							<Avatar className="size-7 shrink-0 overflow-hidden rounded-none after:rounded-none">
								<AvatarImage src={selected.avatarUrl ?? undefined} className="rounded-none" />
								<AvatarFallback className="rounded-none text-[10px]">
									<HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-3" />
								</AvatarFallback>
							</Avatar>
							<p className="flex-1 text-xs font-medium">{selected.displayName}</p>
							<button
								type="button"
								onClick={() => setSelected(null)}
								className="text-[10px] text-muted-foreground hover:text-foreground"
							>
								Change
							</button>
						</div>
					)}

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
