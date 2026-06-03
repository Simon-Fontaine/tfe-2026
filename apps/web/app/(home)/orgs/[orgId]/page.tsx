import { GameController01Icon, Notification01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { appRoutes, publicRoutes } from "@scrimflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { PublicProfileHeader } from "@/components/home/public-profile-header";
import { RecruitmentListingCard } from "@/components/recruit/recruitment-listing-card";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpdatePostCard } from "@/components/updates/update-post-card";
import { getCurrentSession } from "@/lib/auth/session";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import { getPublicOrgByIdOrSlug, getUserOrgRole } from "@/lib/data/organization";
import { getManageableRecruitEntities } from "@/lib/data/recruit";
import { getPublicUpdates } from "@/lib/data/updates";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ orgId: string }>;
}): Promise<Metadata> {
	const { orgId } = await params;
	let org: Awaited<ReturnType<typeof getPublicOrgByIdOrSlug>> | null = null;
	try {
		org = await getPublicOrgByIdOrSlug(orgId);
	} catch {
		// metadata fetch failed
	}
	if (!org) return { title: "Organization not available" };
	return {
		title: org.name,
		description:
			org.description ??
			`View ${org.name}'s public organization profile, teams, and recruiting listings on Scrimflow.`,
	};
}

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
			<PublicPageShell title="Organization" maxWidth="4xl">
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
	const isMember = userOrgRole !== null;
	const websiteHref = getSafeExternalHref(org.website);
	const discordHref = getSafeExternalHref(org.discord);
	const twitterHref = getSafeExternalHref(org.twitter);
	const hasSocialLinks = Boolean(websiteHref || discordHref || twitterHref);
	const entityOptions = user ? await getManageableRecruitEntities(user.id).catch(() => []) : [];
	const orgUpdates = (await getPublicUpdates({ organizationId: org.id }).catch(() => [])).slice(
		0,
		3
	);

	const sortedTeams = [...org.teams].sort((a, b) => b.rating - a.rating);
	const topTeamId = org.teams.length > 1 ? sortedTeams[0]?.id : null;

	return (
		<div className="mx-auto w-full max-w-5xl space-y-8 py-12 px-6">
			<PublicProfileHeader
				name={org.name}
				subtitle={`/${org.slug}`}
				avatarUrl={org.avatarUrl}
				avatarFallback={org.name.substring(0, 2).toUpperCase()}
				bannerUrl={org.bannerUrl}
				meta={
					<>
						<span>
							{org.teamCount} team{org.teamCount === 1 ? "" : "s"}
						</span>
						<span>{org.activeRosterCount} active members</span>
					</>
				}
				badges={
					org.openListings.length > 0 ? (
						<Badge variant="outline" className={STATUS_BADGE_CLASSES.recruiting}>
							Recruiting · {org.openListings.length} open listing
							{org.openListings.length === 1 ? "" : "s"}
						</Badge>
					) : undefined
				}
				actions={
					isMember ? (
						<Button asChild size="sm" variant="outline">
							<Link href={appRoutes.orgs.byId(org.id)}>Open workspace</Link>
						</Button>
					) : (
						<Button asChild size="sm">
							<Link href={publicRoutes.auth.step("register")}>Create an account</Link>
						</Button>
					)
				}
			/>

			{org.description && (
				<p className="max-w-[68ch] text-sm text-muted-foreground">{org.description}</p>
			)}

			<div className="grid gap-8 lg:grid-cols-3">
				<div className="space-y-8 lg:col-span-2">
					<PublicPageSection
						title="Teams"
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
							<div className="divide-y border">
								{sortedTeams.map((team) => (
									<Link
										key={team.id}
										href={publicRoutes.teams.byId(team.id)}
										className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
									>
										<Avatar className="size-9 shrink-0 overflow-hidden rounded-none after:rounded-none">
											<AvatarImage src={team.avatarUrl ?? undefined} className="rounded-none" />
											<AvatarFallback className="rounded-none text-xs font-bold">
												{team.tag}
											</AvatarFallback>
										</Avatar>
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<p className="truncate text-sm font-medium">{team.name}</p>
												{team.id === topTeamId && (
													<Badge variant="outline" className="shrink-0 text-[10px]">
														Top rated
													</Badge>
												)}
											</div>
											<p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
												<HugeiconsIcon
													icon={GameController01Icon}
													strokeWidth={2}
													className="size-3"
												/>
												Rating {team.rating}
											</p>
										</div>
										{team.isRecruiting && (
											<Badge variant="outline" className="shrink-0 text-[10px]">
												Recruiting
											</Badge>
										)}
									</Link>
								))}
							</div>
						)}
					</PublicPageSection>

					<PublicPageSection title="Open organization listings">
						{org.openListings.length === 0 ? (
							<EmptyStateBlock
								icon={GameController01Icon}
								title="No open organization listings right now"
								description="Explore team listings above or browse the full public recruiting directory."
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

					<PublicPageSection title="Organization updates">
						{orgUpdates.length === 0 ? (
							<EmptyStateBlock
								icon={Notification01Icon}
								title="No public updates yet"
								description="This organization has not published any public updates."
								variant="card"
							/>
						) : (
							<div className="space-y-4">
								{orgUpdates.map((post) => (
									<UpdatePostCard
										key={post.id}
										post={post}
										detailHref={publicRoutes.updates.byId(post.id)}
									/>
								))}
							</div>
						)}
					</PublicPageSection>
				</div>

				<aside className="space-y-6">
					<PublicPageSection title="Organization details">
						<dl className="grid grid-cols-2 gap-4 border p-4">
							<div>
								<dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
									Teams
								</dt>
								<dd className="mt-1 text-sm font-semibold">{org.teamCount}</dd>
							</div>
							<div>
								<dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
									Active members
								</dt>
								<dd className="mt-1 text-sm font-semibold">{org.activeRosterCount}</dd>
							</div>
							<div>
								<dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
									Scrims played
								</dt>
								<dd className="mt-1 text-sm font-semibold">{org.totalScrims}</dd>
							</div>
							<div>
								<dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
									Open listings
								</dt>
								<dd className="mt-1 text-sm font-semibold">{org.openListings.length}</dd>
							</div>
						</dl>
					</PublicPageSection>

					{hasSocialLinks && (
						<PublicPageSection title="Links">
							<div className="flex flex-col gap-2 border p-4 text-sm">
								{websiteHref && (
									<a
										href={websiteHref}
										target="_blank"
										rel="noopener noreferrer"
										className="font-medium text-primary underline underline-offset-2 hover:no-underline"
									>
										Website
									</a>
								)}
								{discordHref && (
									<a
										href={discordHref}
										target="_blank"
										rel="noopener noreferrer"
										className="font-medium text-primary underline underline-offset-2 hover:no-underline"
									>
										Discord
									</a>
								)}
								{twitterHref && (
									<a
										href={twitterHref}
										target="_blank"
										rel="noopener noreferrer"
										className="font-medium text-primary underline underline-offset-2 hover:no-underline"
									>
										Twitter / X
									</a>
								)}
							</div>
						</PublicPageSection>
					)}
				</aside>
			</div>
		</div>
	);
}
