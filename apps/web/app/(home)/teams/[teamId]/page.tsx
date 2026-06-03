import { Notification01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import type { OW2Role } from "@scrimflow/shared";
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
import { getUserOrgRole } from "@/lib/data/organization";
import { getManageableRecruitEntities } from "@/lib/data/recruit";
import { getPublicTeamPreview } from "@/lib/data/team";
import { getPublicUpdates } from "@/lib/data/updates";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ teamId: string }>;
}): Promise<Metadata> {
	const { teamId } = await params;
	let team: Awaited<ReturnType<typeof getPublicTeamPreview>> | null = null;
	try {
		team = await getPublicTeamPreview(teamId);
	} catch {
		// metadata fetch failed
	}
	if (!team) return { title: "Team not available" };
	return {
		title: team.name,
		description:
			team.description ??
			`View [${team.tag}] ${team.name}'s public profile, roster, and recruiting listings on Scrimflow.`,
	};
}

function formatTimestamp(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

export default async function TeamProfilePage({ params }: { params: Promise<{ teamId: string }> }) {
	const { teamId } = await params;

	let team: Awaited<ReturnType<typeof getPublicTeamPreview>>;
	try {
		const result = await getPublicTeamPreview(teamId);
		if (!result) {
			notFound();
		}
		team = result;
	} catch {
		return (
			<PublicPageShell title="Team" maxWidth="4xl">
				<EmptyStateBlock
					icon={UserGroupIcon}
					title="Could not load this page"
					description="The team profile could not be loaded right now. Browse public teams or try again in a moment."
					actionHref={publicRoutes.teams.root}
					actionLabel="Browse teams"
					variant="page"
				/>
			</PublicPageShell>
		);
	}

	const { user } = await getCurrentSession();
	const userOrgRole = user
		? await getUserOrgRole(team.organizationId, user.id).catch(() => null)
		: null;
	const canManageInWorkspace = userOrgRole === "owner" || userOrgRole === "admin";
	const isOrgMember = userOrgRole !== null;
	const entityOptions = user ? await getManageableRecruitEntities(user.id).catch(() => []) : [];
	const teamUpdates = (await getPublicUpdates({ teamId: team.id }).catch(() => [])).slice(0, 3);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-8 py-12 px-6">
			<PublicProfileHeader
				name={team.name}
				subtitle={
					<span className="inline-flex flex-wrap items-center gap-1.5">
						<span className="font-mono">[{team.tag}]</span>
						<span aria-hidden>·</span>
						<Link
							href={publicRoutes.orgs.bySlug(team.organizationSlug)}
							className="hover:underline"
						>
							{team.organizationName}
						</Link>
					</span>
				}
				avatarUrl={team.avatarUrl}
				avatarFallback={team.tag}
				bannerUrl={team.bannerUrl}
				meta={
					<>
						<span>Rating {team.rating}</span>
						<span>{team.matchesPlayed} scrims played</span>
						<span>
							{team.activeRosterCount} active member{team.activeRosterCount === 1 ? "" : "s"}
						</span>
					</>
				}
				badges={
					<>
						<Badge
							variant="outline"
							className={team.isRecruiting ? STATUS_BADGE_CLASSES.recruiting : undefined}
						>
							{team.isRecruiting ? "Recruiting" : "Not recruiting"}
						</Badge>
						{team.openListingCount > 0 && (
							<Badge variant="outline" className="text-[10px]">
								{team.openListingCount} open listing{team.openListingCount === 1 ? "" : "s"}
							</Badge>
						)}
					</>
				}
				actions={
					isOrgMember ? (
						<Button asChild size="sm" variant="outline">
							<Link href={appRoutes.teams.byId(team.id)}>
								{canManageInWorkspace ? "Manage in workspace" : "Open workspace"}
							</Link>
						</Button>
					) : (
						<Button asChild size="sm">
							<Link href={publicRoutes.auth.step("register")}>Create an account</Link>
						</Button>
					)
				}
			/>

			{team.description && (
				<p className="max-w-[68ch] text-sm text-muted-foreground">{team.description}</p>
			)}

			<div className="grid gap-8 lg:grid-cols-3">
				<div className="space-y-8 lg:col-span-2">
					<PublicPageSection
						title="Recent scrims"
						description="Last completed matches with opponent and result."
					>
						{team.recentScrims.length === 0 ? (
							<EmptyStateBlock
								icon={UserGroupIcon}
								title="No completed scrims yet"
								description="This team has not completed any public scrims yet."
								variant="card"
							/>
						) : (
							<div className="divide-y border">
								{team.recentScrims.map((scrim) => {
									const scrimResultClass =
										scrim.result === "win"
											? STATUS_BADGE_CLASSES.win
											: scrim.result === "loss"
												? STATUS_BADGE_CLASSES.loss
												: STATUS_BADGE_CLASSES.draw;
									const resultLabel =
										scrim.result === "win" ? "W" : scrim.result === "loss" ? "L" : "D";
									return (
										<div key={scrim.id} className="flex items-center justify-between px-4 py-3">
											<div>
												<p className="text-sm font-medium">
													[{scrim.opponentTag}] {scrim.opponentName}
													{scrim.opponentIsArchived && (
														<span className="ml-1 text-xs text-muted-foreground">(archived)</span>
													)}
												</p>
												{scrim.scheduledAt && (
													<p className="text-xs text-muted-foreground">
														{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
															new Date(scrim.scheduledAt)
														)}
													</p>
												)}
											</div>
											<div className="flex items-center gap-3">
												<span className="text-xs text-muted-foreground">
													{scrim.homeMapScore}–{scrim.awayMapScore}
												</span>
												<Badge
													variant="outline"
													className={`w-6 justify-center text-[10px] ${scrimResultClass}`}
												>
													{resultLabel}
												</Badge>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</PublicPageSection>

					<PublicPageSection
						title="Open listings"
						description="Current opportunities published directly by this team."
					>
						{team.listings.length === 0 ? (
							<EmptyStateBlock
								icon={UserGroupIcon}
								title="No open listings right now"
								description="Check back later or browse other public recruiting listings."
								variant="card"
							/>
						) : (
							<div className="space-y-4">
								{team.listings.map((listing) => (
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

					<PublicPageSection title={`Active roster (${team.activeRosterCount})`}>
						{team.roster.length === 0 ? (
							<EmptyStateBlock
								icon={UserGroupIcon}
								title="No active roster listed yet"
								description="This team has not published any active roster members yet."
								variant="card"
							/>
						) : (
							<div className="divide-y border">
								{team.roster.map((member) => {
									const roleLabel = member.roleInTeam
										? (
												{ tank: "Tank", damage: "DPS", support: "Support" } as Record<
													OW2Role,
													string
												>
											)[member.roleInTeam]
										: member.staffRole
											? member.staffRole.charAt(0).toUpperCase() + member.staffRole.slice(1)
											: null;
									return (
										<Link
											key={member.userId}
											href={publicRoutes.players.byUsername(member.username)}
											className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
										>
											<Avatar className="size-8 shrink-0 overflow-hidden rounded-none after:rounded-none">
												<AvatarImage src={member.avatarUrl ?? undefined} className="rounded-none" />
												<AvatarFallback className="rounded-none text-[10px] font-bold">
													{member.displayName.slice(0, 2).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<div className="min-w-0 flex-1">
												<p className="truncate text-xs font-medium">{member.displayName}</p>
												{roleLabel && (
													<p className="text-[11px] text-muted-foreground">{roleLabel}</p>
												)}
											</div>
											{member.rank && (
												<Badge variant="outline" className="text-[10px]">
													{member.rank}
												</Badge>
											)}
										</Link>
									);
								})}
							</div>
						)}
					</PublicPageSection>

					<PublicPageSection
						title="Team updates"
						description="Public announcements from this team."
					>
						{teamUpdates.length === 0 ? (
							<EmptyStateBlock
								icon={Notification01Icon}
								title="No public updates yet"
								description="This team has not published any public updates."
								variant="card"
							/>
						) : (
							<div className="space-y-4">
								{teamUpdates.map((post) => (
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
					<PublicPageSection title="Team details">
						<dl className="space-y-3 border p-4">
							<div>
								<dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
									Record
								</dt>
								<dd className="mt-1 text-sm font-semibold">
									<span className="text-green-600">{team.wins}W</span>
									{" / "}
									<span className="text-red-600">{team.losses}L</span>
									{" / "}
									<span className="text-muted-foreground">{team.draws}D</span>
								</dd>
							</div>
							<div>
								<dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
									Rating
								</dt>
								<dd className="mt-1 text-sm font-semibold">{team.rating}</dd>
							</div>
							<div>
								<dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
									Roster composition
								</dt>
								<dd className="mt-1 text-sm font-semibold">
									{team.roleBreakdown.tank}T · {team.roleBreakdown.damage}D ·{" "}
									{team.roleBreakdown.support}S
								</dd>
							</div>
						</dl>
					</PublicPageSection>

					<PublicPageSection
						title="Rating trend"
						description="Changes from confirmed scrim results."
					>
						{team.ratingHistory.length === 0 ? (
							<div className="border px-3 py-4">
								<p className="text-xs text-muted-foreground">
									Rating changes appear once both teams confirm a scrim result.
								</p>
							</div>
						) : (
							<div className="divide-y border">
								{team.ratingHistory.slice(0, 6).map((entry) => {
									const deltaText =
										entry.ratingDelta > 0 ? `+${entry.ratingDelta}` : `${entry.ratingDelta}`;
									const resultClass =
										entry.result === "win"
											? STATUS_BADGE_CLASSES.win
											: entry.result === "draw"
												? STATUS_BADGE_CLASSES.draw
												: STATUS_BADGE_CLASSES.loss;
									return (
										<div
											key={entry.id}
											className="flex items-center justify-between gap-2 px-3 py-2.5"
										>
											<div className="min-w-0 flex-1">
												<p className="truncate text-xs font-medium">
													{entry.opponentTeamTag && entry.opponentTeamName
														? `vs [${entry.opponentTeamTag}] ${entry.opponentTeamName}`
														: "Rated scrim"}
												</p>
												<p className="text-[11px] text-muted-foreground">
													{formatTimestamp(entry.createdAt)}
												</p>
											</div>
											<Badge variant="outline" className={`shrink-0 text-[10px] ${resultClass}`}>
												{deltaText}
											</Badge>
										</div>
									);
								})}
							</div>
						)}
					</PublicPageSection>
				</aside>
			</div>
		</div>
	);
}
