import { UserSearch01Icon } from "@hugeicons/core-free-icons";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { PublicRelatedRouteCards } from "@/components/home/public-related-route-cards";
import { RecruitmentListingCard } from "@/components/recruit/recruitment-listing-card";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getPublicPlayerByUsername } from "@/lib/data/player";
import { getManageableRecruitEntities } from "@/lib/data/recruit";
import { ROLE_LABELS } from "@/lib/recruitment";
import { appRoutes, publicRoutes } from "@/lib/routes";

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
		}
		player = result;
	} catch {
		return (
			<PublicPageShell
				title="Player"
				description="Public player profile, role focus, and currently open listings."
				maxWidth="4xl"
			>
				<EmptyStateBlock
					icon={UserSearch01Icon}
					title="Could not load this page"
					description="The player profile could not be loaded right now. Browse public players or try again in a moment."
					actionHref={publicRoutes.players.root}
					actionLabel="Browse players"
					variant="page"
				/>
			</PublicPageShell>
		);
	}

	const { user } = await getCurrentSession();
	const entityOptions = user ? await getManageableRecruitEntities(user.id).catch(() => []) : [];

	return (
		<div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
			{player.bannerUrl && (
				<div className="relative h-36 w-full overflow-hidden border">
					<Image src={player.bannerUrl} alt="" fill className="object-cover" sizes="100vw" />
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
				{user ? (
					<Button asChild size="sm" variant="outline">
						<Link href={appRoutes.profile}>Open your profile workspace</Link>
					</Button>
				) : (
					<Button asChild size="sm" variant="outline">
						<Link href={publicRoutes.auth.step("register")}>Create an account</Link>
					</Button>
				)}
			</div>

			{(player.battletag || player.scrimStats) && (
				<div className="border p-5">
					<div className="flex flex-wrap gap-6">
						{player.battletag && (
							<div>
								<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
									Battletag
								</p>
								<p className="mt-1 text-sm font-semibold">{player.battletag}</p>
							</div>
						)}
						{player.scrimStats && (
							<>
								<div>
									<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
										Scrims
									</p>
									<p className="mt-1 text-sm font-semibold">{player.scrimStats.scrimsPlayed}</p>
								</div>
								<div>
									<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
										Record
									</p>
									<p className="mt-1 text-sm font-semibold">
										<span className="text-green-600">{player.scrimStats.wins}W</span>
										{" / "}
										<span className="text-red-600">{player.scrimStats.losses}L</span>
										{" / "}
										<span className="text-muted-foreground">{player.scrimStats.draws}D</span>
									</p>
								</div>
							</>
						)}
					</div>
				</div>
			)}

			<PublicPageSection
				title="Hero pool"
				description="Heroes this player has selected, grouped by role."
			>
				{player.heroPool.length === 0 ? (
					<EmptyStateBlock
						icon={UserSearch01Icon}
						title="No hero pool set"
						description="This player has not selected any heroes yet."
						variant="card"
					/>
				) : (
					<div className="space-y-4">
						{(["tank", "damage", "support"] as const).map((role) => {
							const heroes = player.heroPool.filter((h) => h.role === role);
							if (heroes.length === 0) return null;
							const roleLabel = role === "tank" ? "Tank" : role === "damage" ? "Damage" : "Support";
							return (
								<div key={role}>
									<p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
										{roleLabel}
									</p>
									<div className="flex flex-wrap gap-2">
										{heroes.map((h) => (
											<Badge key={h.heroId} variant="outline" className="text-[10px]">
												{h.displayName}
											</Badge>
										))}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</PublicPageSection>

			<PublicPageSection title="Active teams" description="Teams this player is currently on.">
				{player.teams.length === 0 ? (
					<EmptyStateBlock
						icon={UserSearch01Icon}
						title="No active team memberships"
						description="This player is not currently listed on any public teams."
						variant="card"
					/>
				) : (
					<div className="divide-y border">
						{player.teams.map((team) => (
							<Link
								key={team.id}
								href={publicRoutes.teams.byId(team.id)}
								className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
							>
								<div>
									<p className="text-sm font-medium">{team.name}</p>
									<p className="text-xs text-muted-foreground">
										[{team.tag}] · {team.organizationName}
									</p>
								</div>
							</Link>
						))}
					</div>
				)}
			</PublicPageSection>

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

			<PublicPageSection
				title="Related public routes"
				description="Use these routes to keep browsing without losing the player-recruiting context."
			>
				<PublicRelatedRouteCards
					cards={[
						{
							label: "More players",
							href: publicRoutes.players.root,
							description:
								"Return to the player directory to compare role coverage and visible rank context.",
						},
						{
							label: "Browse teams",
							href: publicRoutes.teams.root,
							description:
								"See which teams are actively publishing public profiles and recruiting posture.",
						},
						{
							label: "Open recruiting",
							href: publicRoutes.recruiting.root,
							description:
								"Jump straight into the broader recruiting market to evaluate other active opportunities.",
						},
					]}
				/>
			</PublicPageSection>
		</div>
	);
}
