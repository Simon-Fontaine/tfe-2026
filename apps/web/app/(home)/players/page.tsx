import { UserSearch01Icon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Players",
	description: "Discover Overwatch 2 players by role and rank.",
};

import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicPlayers } from "@/lib/data/player";
import { ROLE_LABELS } from "@/lib/recruitment";

export default async function PlayersDirectoryPage() {
	const players = await getPublicPlayers();

	return (
		<section className="border-b px-4 py-14 md:py-20" aria-labelledby="players-heading">
			<div className="mx-auto max-w-6xl space-y-6">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<h1 id="players-heading" className="text-lg font-bold leading-tight md:text-2xl">
							Players
						</h1>
						<p className="mt-3 max-w-[48ch] text-xs leading-relaxed text-muted-foreground">
							Browse registered players by role and rank.
						</p>
					</div>
					<Button asChild size="sm">
						<Link href="/posts">Browse all recruiting posts</Link>
					</Button>
				</div>

				{players.length === 0 ? (
					<EmptyStateBlock
						icon={UserSearch01Icon}
						title="No players yet"
						description="Players will appear here once they complete their profile."
						variant="page"
					/>
				) : (
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{players.map((player) => (
							<Link
								key={player.id}
								href={`/players/${player.username}`}
								className="space-y-3 border p-4 transition-colors hover:bg-muted/50"
							>
								<div className="flex items-center gap-3">
									<Avatar className="size-10 shrink-0 overflow-hidden rounded-none after:rounded-none">
										<AvatarImage src={player.avatarUrl ?? undefined} className="rounded-none" />
										<AvatarFallback className="rounded-none text-xs font-bold">
											{player.displayName.slice(0, 2).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-semibold">{player.displayName}</p>
										<p className="text-xs text-muted-foreground">@{player.username}</p>
									</div>
								</div>
								<div className="flex flex-wrap gap-2">
									{player.primaryRole && (
										<Badge variant="outline" className="text-[10px]">
											{ROLE_LABELS[player.primaryRole]}
										</Badge>
									)}
									{player.rank && (
										<Badge variant="secondary" className="text-[10px]">
											{player.rank}
										</Badge>
									)}
								</div>
								{player.bio && (
									<p className="line-clamp-3 text-xs text-muted-foreground">{player.bio}</p>
								)}
							</Link>
						))}
					</div>
				)}
			</div>
		</section>
	);
}
