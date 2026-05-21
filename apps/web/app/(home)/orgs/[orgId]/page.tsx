import { ArrowRight01Icon, GameController01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
import { getPublicOrgByIdOrSlug, getUserOrgRole } from "@/lib/data/organization";
import { getManageableRecruitEntities } from "@/lib/data/recruit";
import { appRoutes, publicRoutes } from "@/lib/routes";

function getSafeExternalHref(value: string | null): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
	} catch {
		return null;
	}
}

export default async function OrgProfilePage({ params }: { params: Promise<{ orgId: string }> }) {
	const { orgId } = await params;

	let org: Awaited<ReturnType<typeof getPublicOrgByIdOrSlug>>;
	try {
		const result = await getPublicOrgByIdOrSlug(orgId);
		if (!result) {
			notFound();
		}
		org = result;
	} catch {
		return (
			<PublicPageShell
				title="Organization"
				description="Public teams and recruiting listings published by this organization."
				maxWidth="5xl"
			>
				<EmptyStateBlock
					icon={GameController01Icon}
					title="Could not load this page"
					description="The organization profile could not be loaded right now. Browse public organizations or try again in a moment."
					actionHref={publicRoutes.orgs.root}
					actionLabel="Browse organizations"
					variant="page"
				/>
			</PublicPageShell>
		);
	}

	const { user } = await getCurrentSession();
	const userOrgRole = user ? await getUserOrgRole(org.id, user.id).catch(() => null) : null;
	const websiteHref = getSafeExternalHref(org.website);
	const discordHref = getSafeExternalHref(org.discord);
	const twitterHref = getSafeExternalHref(org.twitter);
	const isMember = userOrgRole !== null;
	const entityOptions = user ? await getManageableRecruitEntities(user.id).catch(() => []) : [];

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			{org.bannerUrl && (
				<div className="relative h-36 w-full overflow-hidden border">
					<Image src={org.bannerUrl} alt="" fill className="object-cover" sizes="100vw" />
				</div>
			)}
			<div className="border p-5">
				<div className="flex items-start gap-4">
					<Avatar className="size-14 shrink-0 overflow-hidden rounded-none after:rounded-none">
						<AvatarImage src={org.avatarUrl ?? undefined} className="rounded-none" />
						<AvatarFallback className="rounded-none text-sm font-bold">
							{org.name.substring(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<h1 className="text-lg font-bold sm:text-xl">{org.name}</h1>
						<p className="text-xs text-muted-foreground">/{org.slug}</p>
						{org.description && (
							<p className="mt-2 text-sm text-muted-foreground">{org.description}</p>
						)}
						<p className="mt-2 text-xs text-muted-foreground">
							{org.teamCount} team{org.teamCount === 1 ? "" : "s"} · {org.activeRosterCount} active
							members
						</p>
					</div>
				</div>
			</div>

			<div className="flex flex-wrap gap-2">
				<Button asChild size="sm">
					<Link href={publicRoutes.recruiting.root}>
						Browse all listings
						<HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="ml-1 size-4" />
					</Link>
				</Button>
				{isMember && (
					<Button asChild size="sm" variant="outline">
						<Link href={appRoutes.orgs.byId(org.id)}>Open workspace</Link>
					</Button>
				)}
				{!isMember && (
					<Button asChild size="sm" variant="outline">
						<Link href={publicRoutes.auth.step("register")}>Create an account</Link>
					</Button>
				)}
				<Button asChild size="sm" variant="outline">
					<Link href={publicRoutes.orgs.root}>Back to organizations</Link>
				</Button>
			</div>

			<div className="border p-5">
				<div className="flex flex-wrap gap-6">
					<div>
						<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
							Teams
						</p>
						<p className="mt-1 text-sm font-semibold">{org.teamCount}</p>
					</div>
					<div>
						<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
							Active members
						</p>
						<p className="mt-1 text-sm font-semibold">{org.activeRosterCount}</p>
					</div>
					<div>
						<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
							Scrims played
						</p>
						<p className="mt-1 text-sm font-semibold">{org.totalScrims}</p>
					</div>
					<div>
						<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
							Open listings
						</p>
						<p className="mt-1 text-sm font-semibold">{org.openListings.length}</p>
					</div>
				</div>
				{(websiteHref || discordHref || twitterHref) && (
					<div className="mt-4 flex flex-wrap gap-4 border-t pt-4">
						{websiteHref && (
							<a
								href={websiteHref}
								target="_blank"
								rel="noopener noreferrer"
								className="text-xs font-medium text-primary underline underline-offset-2 hover:no-underline"
							>
								Website
							</a>
						)}
						{discordHref && (
							<a
								href={discordHref}
								target="_blank"
								rel="noopener noreferrer"
								className="text-xs font-medium text-primary underline underline-offset-2 hover:no-underline"
							>
								Discord
							</a>
						)}
						{twitterHref && (
							<a
								href={twitterHref}
								target="_blank"
								rel="noopener noreferrer"
								className="text-xs font-medium text-primary underline underline-offset-2 hover:no-underline"
							>
								Twitter / X
							</a>
						)}
					</div>
				)}
			</div>

			{(() => {
				const topTeam = org.teams.reduce(
					(best, t) => (!best || t.rating > best.rating ? t : best),
					null as (typeof org.teams)[number] | null
				);
				if (!topTeam) return null;
				return (
					<div>
						<p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
							Top-rated team
						</p>
						<Link
							href={publicRoutes.teams.byId(topTeam.id)}
							className="flex items-center gap-3 border p-4 transition-colors hover:bg-muted/50"
						>
							<Avatar className="size-10 shrink-0 overflow-hidden rounded-none after:rounded-none">
								<AvatarImage src={topTeam.avatarUrl ?? undefined} className="rounded-none" />
								<AvatarFallback className="rounded-none text-xs font-bold">
									{topTeam.tag}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium">{topTeam.name}</p>
								<p className="text-xs text-muted-foreground">Rating {topTeam.rating}</p>
							</div>
							{topTeam.isRecruiting && (
								<Badge variant="secondary" className="text-[10px]">
									Recruiting
								</Badge>
							)}
						</Link>
					</div>
				);
			})()}

			{org.openListings.length > 0 && (
				<div className="border p-4">
					<p className="text-xs font-medium text-muted-foreground">
						Currently recruiting ·{" "}
						<span className="font-semibold text-foreground">
							{org.openListings.length} open listing{org.openListings.length === 1 ? "" : "s"}
						</span>
					</p>
				</div>
			)}

			<PublicPageSection
				title="Open organization listings"
				description="Public organization recruiting listings are surfaced here instead of join-request forms."
			>
				{org.openListings.length === 0 ? (
					<EmptyStateBlock
						icon={GameController01Icon}
						title="No open organization listings right now"
						description="Explore team listings below or browse the full public recruiting directory."
						variant="card"
					/>
				) : (
					<div className="space-y-4">
						{org.openListings.map((listing) => (
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
				title="Teams"
				description="Follow these public team routes to inspect roster depth, recruiting status, and player surfaces."
				className="space-y-3"
				actions={
					<Button asChild size="sm" variant="outline">
						<Link href={publicRoutes.teams.root}>Browse all teams</Link>
					</Button>
				}
			>
				{org.teams.length === 0 ? (
					<EmptyStateBlock
						icon={GameController01Icon}
						title="No public teams yet"
						description="This organization has not published any teams yet."
						variant="card"
					/>
				) : (
					<div className="grid gap-3 sm:grid-cols-2">
						{org.teams.map((team) => (
							<Link
								key={team.id}
								href={publicRoutes.teams.byId(team.id)}
								className="flex items-center gap-3 border p-4 transition-colors hover:bg-muted/50"
							>
								<Avatar className="size-9 shrink-0 overflow-hidden rounded-none after:rounded-none">
									<AvatarImage src={team.avatarUrl ?? undefined} className="rounded-none" />
									<AvatarFallback className="rounded-none text-xs font-bold">
										{team.tag}
									</AvatarFallback>
								</Avatar>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">{team.name}</p>
									<p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
										<HugeiconsIcon icon={GameController01Icon} strokeWidth={2} className="size-3" />
										Rating {team.rating}
									</p>
								</div>
								{team.isRecruiting && (
									<Badge variant="secondary" className="text-[10px]">
										Recruiting
									</Badge>
								)}
							</Link>
						))}
					</div>
				)}
			</PublicPageSection>

			<PublicPageSection
				title="Next public routes"
				description="Keep moving through the public funnel without losing context."
			>
				<PublicRelatedRouteCards
					cards={[
						{
							label: "Updates",
							href: publicRoutes.updates.root,
							description:
								"Check recent public announcements from orgs and teams across the platform.",
						},
						{
							label: "Scrims",
							href: publicRoutes.scrims.root,
							description:
								"See whether the broader competitive ecosystem is active and publishing recent results.",
						},
						{
							label: "Recruiting",
							href: publicRoutes.recruiting.root,
							description:
								"Return to the full directory if you want to compare this org with other active listings.",
						},
					]}
				/>
			</PublicPageSection>
		</div>
	);
}
