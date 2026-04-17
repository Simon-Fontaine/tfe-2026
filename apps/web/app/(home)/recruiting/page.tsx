import { UserSearch01Icon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { RecruitmentListingCard } from "@/components/recruit/recruitment-listing-card";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getManageableRecruitEntities, getPublicRecruitmentListings } from "@/lib/data/recruit";
import { RECRUITMENT_CATEGORY_LABELS } from "@/lib/recruitment";
import { publicRoutes } from "@/lib/routes";

export const metadata: Metadata = {
	title: "Recruiting",
	description: "Browse Overwatch 2 recruiting listings for players, teams, and staff.",
};

const CATEGORY_FILTERS = ["all", "lft", "lfp", "lfr", "lfs"] as const;

interface PublicRecruitingPageProps {
	searchParams: Promise<{ category?: string; memberType?: string; region?: string }>;
}

export default async function PublicRecruitingPage({ searchParams }: PublicRecruitingPageProps) {
	const { user } = await getCurrentSession();
	const { category: categoryParam, memberType, region } = await searchParams;
	const category = CATEGORY_FILTERS.includes(
		(categoryParam ?? "all") as (typeof CATEGORY_FILTERS)[number]
	)
		? ((categoryParam ?? "all") as (typeof CATEGORY_FILTERS)[number])
		: "all";
	const entityOptions = user ? await getManageableRecruitEntities(user.id) : [];
	const listings = await getPublicRecruitmentListings({
		category: category === "all" ? undefined : category,
		memberType:
			memberType === "player" || memberType === "staff"
				? (memberType as "player" | "staff")
				: undefined,
		region: region || undefined,
	});

	return (
		<PublicPageShell
			title="Recruiting"
			description="Public recruiting listings replace the old Discord channels and keep player, team, and staff discovery in one place."
			maxWidth="6xl"
			contentClassName="space-y-6"
			actions={
				<Button asChild size="sm">
					<Link href={user ? "/app/recruiting" : "/auth?step=login"}>
						{user ? "Open recruiting workspace" : "Sign in to apply"}
					</Link>
				</Button>
			}
		>
			<div className="flex flex-wrap gap-2">
				{CATEGORY_FILTERS.map((filter) => (
					<Link
						key={filter}
						href={
							filter === "all"
								? publicRoutes.recruiting.root
								: `${publicRoutes.recruiting.root}?category=${filter}`
						}
					>
						<Badge variant={category === filter ? "default" : "outline"}>
							{filter === "all" ? "All listings" : RECRUITMENT_CATEGORY_LABELS[filter]}
						</Badge>
					</Link>
				))}
			</div>

			{listings.length === 0 ? (
				<EmptyStateBlock
					icon={UserSearch01Icon}
					title="No public listings match this filter"
					description="Check another category or create a recruiting listing from your team workspace."
					variant="page"
				/>
			) : (
				<div className="space-y-4">
					{listings.map((listing) => (
						<RecruitmentListingCard
							key={listing.id}
							listing={listing}
							currentUserId={user?.id ?? null}
							entityOptions={entityOptions}
							detailHref={publicRoutes.recruiting.byId(listing.id)}
						/>
					))}
				</div>
			)}
		</PublicPageShell>
	);
}
