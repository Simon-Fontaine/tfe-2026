import { UserSearch01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";

import { RecruitmentPostCard } from "@/components/recruit/recruitment-post-card";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getManageableRecruitEntities, getPublicRecruitmentPosts } from "@/lib/data/recruit";
import { RECRUITMENT_CATEGORY_LABELS } from "@/lib/recruitment";

const CATEGORY_FILTERS = ["all", "lft", "lfp", "lfr", "lfs"] as const;

interface PublicPostsPageProps {
	searchParams: Promise<{ category?: string; memberType?: string; region?: string }>;
}

export default async function PublicPostsPage({ searchParams }: PublicPostsPageProps) {
	const { user } = await getCurrentSession();
	const { category: categoryParam, memberType, region } = await searchParams;
	const category = CATEGORY_FILTERS.includes(
		(categoryParam ?? "all") as (typeof CATEGORY_FILTERS)[number]
	)
		? ((categoryParam ?? "all") as (typeof CATEGORY_FILTERS)[number])
		: "all";
	const entityOptions = user ? await getManageableRecruitEntities(user.id) : [];
	const posts = await getPublicRecruitmentPosts({
		category: category === "all" ? undefined : category,
		memberType:
			memberType === "player" || memberType === "staff"
				? (memberType as "player" | "staff")
				: undefined,
		region: region || undefined,
	});

	return (
		<section className="border-b px-4 py-14 md:py-20" aria-labelledby="posts-heading">
			<div className="mx-auto max-w-6xl space-y-6">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<h1 id="posts-heading" className="text-lg font-bold leading-tight md:text-2xl">
							Recruiting Posts
						</h1>
						<p className="mt-3 max-w-[56ch] text-xs leading-relaxed text-muted-foreground">
							Public LFT, LFP, LFR, and LFS posts replace the old Discord channels and keep player,
							team, and staff recruiting in one place.
						</p>
					</div>
					<Button asChild size="sm">
						<Link href={user ? "/dashboard/discover/posts" : "/auth?step=login"}>
							{user ? "Open dashboard recruiting" : "Sign in to respond"}
						</Link>
					</Button>
				</div>

				<div className="flex flex-wrap gap-2">
					{CATEGORY_FILTERS.map((filter) => (
						<Link key={filter} href={filter === "all" ? "/posts" : `/posts?category=${filter}`}>
							<Badge variant={category === filter ? "default" : "outline"}>
								{filter === "all" ? "All posts" : RECRUITMENT_CATEGORY_LABELS[filter]}
							</Badge>
						</Link>
					))}
				</div>

				{posts.length === 0 ? (
					<EmptyStateBlock
						icon={UserSearch01Icon}
						title="No public posts match this filter"
						description="Check another category or create a recruiting post from the dashboard."
						variant="page"
					/>
				) : (
					<div className="space-y-4">
						{posts.map((post) => (
							<RecruitmentPostCard
								key={post.id}
								post={post}
								currentUserId={user?.id ?? null}
								entityOptions={entityOptions}
							/>
						))}
					</div>
				)}
			</div>
		</section>
	);
}
