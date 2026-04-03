import { ArrowRight01Icon, GameController01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicPageSection } from "@/components/home/public-page-section";
import { RecruitmentPostCard } from "@/components/recruit/recruitment-post-card";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getPublicOrgByIdOrSlug, getUserOrgRole } from "@/lib/data/organization";
import { getManageableRecruitEntities } from "@/lib/data/recruit";
import { publicRoutes } from "@/lib/routes";

export default async function OrgProfilePage({ params }: { params: Promise<{ orgId: string }> }) {
	const { orgId } = await params;
	const org = await getPublicOrgByIdOrSlug(orgId);
	if (!org) notFound();

	const { user } = await getCurrentSession();
	const userOrgRole = user ? await getUserOrgRole(org.id, user.id).catch(() => null) : null;
	const isMember = userOrgRole !== null;
	const entityOptions = user ? await getManageableRecruitEntities(user.id) : [];

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			{org.bannerUrl && (
				<div className="relative h-36 w-full overflow-hidden border">
					<Image
						src={org.bannerUrl}
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
					<Link href="/posts">
						Browse all posts
						<HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="ml-1 size-4" />
					</Link>
				</Button>
				{isMember && (
					<Button asChild size="sm" variant="outline">
						<Link href={`/dashboard/c/org/${org.id}`}>Open workspace</Link>
					</Button>
				)}
			</div>

			<PublicPageSection
				title="Open organisation posts"
				description="Public organisation recruiting posts are surfaced here instead of join-request forms."
			>
				{org.openPosts.length === 0 ? (
					<EmptyStateBlock
						icon={GameController01Icon}
						title="No open organisation posts right now"
						description="Explore team posts below or browse the full public posts hub."
						variant="card"
					/>
				) : (
					<div className="space-y-4">
						{org.openPosts.map((post) => (
							<RecruitmentPostCard
								key={post.id}
								post={post}
								currentUserId={user?.id ?? null}
								entityOptions={entityOptions}
							/>
						))}
					</div>
				)}
			</PublicPageSection>

			<PublicPageSection title="Teams" className="space-y-3">
				{org.teams.length === 0 ? (
					<EmptyStateBlock
						icon={GameController01Icon}
						title="No public teams yet"
						description="This organisation has not published any teams yet."
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
										SR {team.teamSr}
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
		</div>
	);
}
