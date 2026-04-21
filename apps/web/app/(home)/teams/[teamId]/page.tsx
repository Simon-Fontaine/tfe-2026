import { ArrowRight01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { OW2Role } from "@scrimflow/shared";
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
import { getUserOrgRole } from "@/lib/data/organization";
import { getManageableRecruitEntities } from "@/lib/data/recruit";
import { getPublicTeamPreview } from "@/lib/data/team";
import { appRoutes, publicRoutes } from "@/lib/routes";

export default async function TeamProfilePage({ params }: { params: Promise<{ teamId: string }> }) {
	const { teamId } = await params;

	let team: Awaited<ReturnType<typeof getPublicTeamPreview>>;
	try {
		const result = await getPublicTeamPreview(teamId);
		if (!result) {
			notFound();
			return null;
		}
		team = result;
	} catch {
		return (
			<div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
				<EmptyStateBlock
					icon={UserGroupIcon}
					title="Could not load this page"
					description="Something went wrong. Please go back and try again."
					variant="page"
				/>
			</div>
		);
	}

	const { user } = await getCurrentSession();
	const userOrgRole = user
		? await getUserOrgRole(team.organizationId, user.id).catch(() => null)
		: null;
	const canManageInWorkspace = userOrgRole === "owner" || userOrgRole === "admin";
	const isOrgMember = userOrgRole !== null;
	const entityOptions = user ? await getManageableRecruitEntities(user.id).catch(() => []) : [];

	return (
		<div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
			{team.bannerUrl && (
				<div className="relative h-36 w-full overflow-hidden border">
					<Image
						src={team.bannerUrl}
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
						<AvatarImage src={team.avatarUrl ?? undefined} className="rounded-none" />
						<AvatarFallback className="rounded-none text-sm font-bold">{team.tag}</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1 space-y-2">
						<div className="flex items-center gap-2">
							<h1 className="text-lg font-bold sm:text-xl">{team.name}</h1>
							<span className="font-mono text-xs text-muted-foreground">[{team.tag}]</span>
							<Link
								href={publicRoutes.orgs.bySlug(team.organizationSlug)}
								className="text-xs text-muted-foreground hover:underline"
							>
								{team.organizationName}
							</Link>
						</div>
						<p className="text-xs text-muted-foreground">
							Rating {team.rating} · {team.matchesPlayed} scrims played
						</p>
						{team.description && (
							<p className="text-sm text-muted-foreground">{team.description}</p>
						)}
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant={team.isRecruiting ? "secondary" : "outline"}>
								{team.isRecruiting ? "Recruiting" : "Not recruiting"}
							</Badge>
							<span className="flex items-center gap-1 text-xs text-muted-foreground">
								<HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-3" />
								{team.activeRosterCount} active member{team.activeRosterCount === 1 ? "" : "s"}
							</span>
							{team.openListingCount > 0 && (
								<Badge variant="outline" className="text-[10px]">
									{team.openListingCount} open listing{team.openListingCount === 1 ? "" : "s"}
								</Badge>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className="border p-5">
				<h2 className="text-sm font-semibold">Recruiting</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					Use the team’s public recruiting listings below instead of request-to-join forms or
					Discord channels.
				</p>
				<div className="mt-3 flex flex-wrap gap-2">
					<Button asChild size="sm">
						<Link href={publicRoutes.recruiting.root}>
							Browse all listings
							<HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="ml-1 size-4" />
						</Link>
					</Button>
					{isOrgMember && (
						<Button asChild size="sm" variant="outline">
							<Link href={appRoutes.teams.byId(team.id)}>
								{canManageInWorkspace ? "Manage in workspace" : "Open workspace"}
							</Link>
						</Button>
					)}
				</div>
			</div>

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

			<PublicPageSection title={`Active roster (${team.activeRosterCount})`} className="space-y-3">
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
								? ({ tank: "Tank", damage: "DPS", support: "Support" } as Record<OW2Role, string>)[
										member.roleInTeam
									]
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
										{roleLabel && <p className="text-[11px] text-muted-foreground">{roleLabel}</p>}
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
		</div>
	);
}
