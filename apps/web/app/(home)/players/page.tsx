import { UserSearch01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

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
							Public player profiles now surface open LFT and LFS posts directly.
						</p>
					</div>
					<Button asChild size="sm">
						<Link href="/posts">Browse all recruiting posts</Link>
					</Button>
				</div>

				{players.length === 0 ? (
					<div className="flex flex-col items-center justify-center border border-dashed p-6 py-16 text-center">
						<div className="mb-4 flex size-10 items-center justify-center border bg-primary/10">
							<HugeiconsIcon
								icon={UserSearch01Icon}
								strokeWidth={2}
								className="size-5 text-primary"
							/>
						</div>
						<p className="text-sm font-bold">No public player posts yet</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Check the posts hub or come back later as more players publish availability.
						</p>
					</div>
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
									<Badge variant="outline" className="text-[10px]">
										{player.openPosts.length} open post{player.openPosts.length === 1 ? "" : "s"}
									</Badge>
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
