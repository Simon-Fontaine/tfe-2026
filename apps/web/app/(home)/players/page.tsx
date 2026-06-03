import { UserSearch01Icon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Players",
	description: "Discover Overwatch 2 players by role and rank.",
};

import { publicRoutes } from "@scrimflow/shared";
import { Suspense } from "react";
import { PublicFilterBar } from "@/components/home/public-filter-bar";
import { PublicListLoading } from "@/components/home/public-page-loading";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicPlayers } from "@/lib/data/player";
import { ROLE_LABELS } from "@/lib/recruitment";

type PlayerRoleFilter = "all" | "tank" | "damage" | "support";

interface PlayersDirectoryPageProps {
	searchParams: Promise<{ role?: string }>;
}

export default async function PlayersDirectoryPage({ searchParams }: PlayersDirectoryPageProps) {
	const { role: roleParam } = await searchParams;
	const role = (["all", "tank", "damage", "support"] as const).includes(
		(roleParam ?? "all") as PlayerRoleFilter
	)
		? ((roleParam ?? "all") as PlayerRoleFilter)
		: "all";

	return (
		<PublicPageShell
			title="Players"
			maxWidth="6xl"
			contentClassName="space-y-6"
			actions={
				<Button asChild size="sm">
					<Link href={publicRoutes.recruiting.root}>Browse all recruiting listings</Link>
				</Button>
			}
		>
			<PublicFilterBar
				options={(
					[
						["all", "All players"],
						["tank", "Tank"],
						["damage", "DPS"],
						["support", "Support"],
					] as const
				).map(([value, label]) => ({
					label,
					href:
						value === "all"
							? publicRoutes.players.root
							: `${publicRoutes.players.root}?role=${value}`,
					active: role === value,
				}))}
			/>
			<Suspense fallback={<PublicListLoading itemCount={8} itemHeightClassName="h-14" />}>
				<PlayerListSection role={role} />
			</Suspense>
		</PublicPageShell>
	);
}

async function PlayerListSection({ role }: { role: PlayerRoleFilter }) {
	let players: Awaited<ReturnType<typeof getPublicPlayers>> = [];
	let hasError = false;
	try {
		players = await getPublicPlayers();
	} catch {
		hasError = true;
	}

	if (hasError) {
		return (
			<EmptyStateBlock
				icon={UserSearch01Icon}
				title="Could not load content"
				description="Something went wrong loading this page. Please refresh to try again."
				variant="page"
			/>
		);
	}

	if (players.length === 0) {
		return (
			<EmptyStateBlock
				icon={UserSearch01Icon}
				title="No public players yet"
				description="Check back later as players set up their profiles."
				variant="page"
			/>
		);
	}

	const filteredPlayers =
		role === "all"
			? players
			: players.filter((player) => player.primaryRole === role || player.secondaryRole === role);

	if (filteredPlayers.length === 0) {
		return (
			<EmptyStateBlock
				icon={UserSearch01Icon}
				title="No players match this role yet"
				description="Try another role filter or browse the full recruiting directory for active opportunities."
				variant="page"
			/>
		);
	}

	return (
		<div className="divide-y border">
			{filteredPlayers.map((player) => (
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
	);
}
