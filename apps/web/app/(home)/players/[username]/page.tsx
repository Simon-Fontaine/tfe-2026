import { UserSearch01Icon } from "@hugeicons/core-free-icons";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicPageSection } from "@/components/home/public-page-section";
import { RecruitmentListingCard } from "@/components/recruit/recruitment-listing-card";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getPublicPlayerByUsername } from "@/lib/data/player";
import { getManageableRecruitEntities } from "@/lib/data/recruit";
import { ROLE_LABELS } from "@/lib/recruitment";
import { publicRoutes } from "@/lib/routes";

export default async function PlayerProfilePage({
	params,
}: {
	params: Promise<{ username: string }>;
}) {
	const { username } = await params;

	let player: Awaited<ReturnType<typeof getPublicPlayerByUsername>>;
	try {
		const result = await getPublicPlayerByUsername(username);
		if (!result) {
			notFound();
			return null;
		}
		player = result;
	} catch {
		return (
			<div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
				<EmptyStateBlock
					icon={UserSearch01Icon}
					title="Could not load this page"
					description="Something went wrong. Please go back and try again."
					variant="page"
				/>
			</div>
		);
	}

	const { user } = await getCurrentSession();
	const entityOptions = user ? await getManageableRecruitEntities(user.id).catch(() => []) : [];

	return (
		<div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
			{player.bannerUrl && (
				<div className="relative h-36 w-full overflow-hidden border">
					<Image
						src={player.bannerUrl}
						alt=""
						fill
						unoptimized
						className="object-cover"
						sizes="100vw"
					/>
				</div>
			)}
			<div className="border p-5">
				<div className="flex items-start gap-4">
					<Avatar className="size-14 shrink-0 overflow-hidden rounded-none after:rounded-none">
						<AvatarImage src={player.avatarUrl ?? undefined} className="rounded-none" />
						<AvatarFallback className="rounded-none text-sm font-bold">
							{player.displayName.slice(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<h1 className="text-lg font-bold sm:text-xl">{player.displayName}</h1>
						<p className="text-xs text-muted-foreground">@{player.username}</p>
						{player.bio && <p className="mt-2 text-sm text-muted-foreground">{player.bio}</p>}
						<div className="mt-3 flex flex-wrap gap-2">
							{player.primaryRole && (
								<Badge variant="outline" className="text-[10px]">
									{ROLE_LABELS[player.primaryRole]}
								</Badge>
							)}
							{player.secondaryRole && (
								<Badge variant="outline" className="text-[10px]">
									{ROLE_LABELS[player.secondaryRole]}
								</Badge>
							)}
							{player.rank && (
								<Badge variant="secondary" className="text-[10px]">
									{player.rank}
									{player.rankDivision ? ` ${player.rankDivision}` : ""}
								</Badge>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-wrap gap-2">
				<Button asChild size="sm" variant="outline">
					<Link href={publicRoutes.players.root}>Back to players</Link>
				</Button>
				<Button asChild size="sm">
					<Link href={publicRoutes.recruiting.root}>Browse all listings</Link>
				</Button>
			</div>

			<PublicPageSection
				title="Open listings"
				description="Public availability and recruiting listings published directly by this player."
			>
				{player.openListings.length === 0 ? (
					<EmptyStateBlock
						icon={UserSearch01Icon}
						title="No public listings right now"
						description="Check recruiting for other open opportunities."
						variant="card"
					/>
				) : (
					<div className="space-y-4">
						{player.openListings.map((listing) => (
							<RecruitmentListingCard
								key={listing.id}
								listing={listing}
								currentUserId={user?.id ?? null}
								entityOptions={entityOptions}
							/>
						))}
					</div>
				)}
			</PublicPageSection>
		</div>
	);
}
