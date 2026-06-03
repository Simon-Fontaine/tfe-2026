"use client";

import { UserSearch01Icon } from "@hugeicons/core-free-icons";
import { type PublicPlayerSummary, publicRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DirectorySearch } from "@/components/home/directory-search";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/recruitment";

export function PlayersDirectoryList({ players }: { players: PublicPlayerSummary[] }) {
	const [query, setQuery] = useState("");
	const normalized = query.trim().toLowerCase();

	const filtered = useMemo(() => {
		if (normalized === "") return players;
		return players.filter(
			(player) =>
				player.displayName.toLowerCase().includes(normalized) ||
				player.username.toLowerCase().includes(normalized)
		);
	}, [players, normalized]);

	return (
		<div className="space-y-4">
			<DirectorySearch
				value={query}
				onChange={setQuery}
				placeholder="Search players by name or username"
				resultCount={filtered.length}
				noun="player"
			/>
			{filtered.length === 0 ? (
				<EmptyStateBlock
					icon={UserSearch01Icon}
					title="No players match your search"
					description={`No players matched "${query.trim()}". Try a different name or username.`}
					variant="card"
				/>
			) : (
				<div className="divide-y border">
					{filtered.map((player) => (
						<Link
							key={player.id}
							href={publicRoutes.players.byUsername(player.username)}
							className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
						>
							<Avatar className="size-10 shrink-0 overflow-hidden rounded-none after:rounded-none">
								<AvatarImage src={player.avatarUrl ?? undefined} className="rounded-none" />
								<AvatarFallback className="rounded-none text-xs font-bold">
									{player.displayName.slice(0, 2).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-semibold">{player.displayName}</p>
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-xs text-muted-foreground">@{player.username}</span>
									{player.primaryRole && (
										<Badge variant="outline" className="text-[10px]">
											{ROLE_LABELS[player.primaryRole]}
										</Badge>
									)}
									{player.rank && (
										<Badge variant="outline" className="text-[10px]">
											{player.rank}
										</Badge>
									)}
								</div>
							</div>
							<Badge
								variant={player.recruitingStatus === "looking" ? "default" : "outline"}
								className="shrink-0 text-[10px]"
							>
								{player.recruitingStatus === "looking" ? "Looking for team" : "Unavailable"}
							</Badge>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
