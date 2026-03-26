import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { RecruitmentPostCard } from "@/components/recruit/recruitment-post-card";
import { RecruitmentPostFormDialog } from "@/components/recruit/recruitment-post-form-dialog";
import { RecruitmentSentResponsesPanel } from "@/components/recruit/recruitment-sent-responses-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import {
	getManageableRecruitEntities,
	getMyRecruitmentPosts,
	getMyRecruitmentResponses,
	getRecruitmentPosts,
	getRecruitmentResponsesForPost,
} from "@/lib/data/recruit";
import { RECRUITMENT_CATEGORY_LABELS } from "@/lib/recruitment";
import { dashboardRoutes } from "@/lib/routes";

const CATEGORY_FILTERS = ["all", "lft", "lfp", "lfr", "lfs"] as const;

interface RecruitPostsPageProps {
	searchParams: Promise<{ category?: string }>;
}

export default async function RecruitPostsPage({ searchParams }: RecruitPostsPageProps) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { category: categoryParam } = await searchParams;
	const category = CATEGORY_FILTERS.includes(
		(categoryParam ?? "all") as (typeof CATEGORY_FILTERS)[number]
	)
		? ((categoryParam ?? "all") as (typeof CATEGORY_FILTERS)[number])
		: "all";

	const [entityOptions, myPosts, myResponses, openPosts] = await Promise.all([
		getManageableRecruitEntities(user.id),
		getMyRecruitmentPosts(),
		getMyRecruitmentResponses(),
		getRecruitmentPosts({
			category: category === "all" ? undefined : category,
		}),
	]);

	const myPostIds = new Set(myPosts.map((post) => post.id));
	const discoverPosts = openPosts.filter((post) => !myPostIds.has(post.id));
	const myResponsesByPost = new Map(
		await Promise.all(
			myPosts.map(async (post) => [post.id, await getRecruitmentResponsesForPost(post.id)] as const)
		)
	);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-bold">Recruit Posts</h1>
					<p className="text-xs text-muted-foreground">
						Publish, manage, and browse LFT, LFP, LFR, and LFS posts
					</p>
				</div>
				<RecruitmentPostFormDialog ownerOptions={entityOptions}>
					<Button size="sm">
						<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
						New post
					</Button>
				</RecruitmentPostFormDialog>
			</div>

			<div className="flex flex-wrap gap-2">
				{CATEGORY_FILTERS.map((filter) => (
					<Link
						key={filter}
						href={
							filter === "all"
								? dashboardRoutes.discover.posts
								: `${dashboardRoutes.discover.posts}?category=${filter}`
						}
					>
						<Badge variant={category === filter ? "default" : "outline"} className="capitalize">
							{filter === "all" ? "All posts" : RECRUITMENT_CATEGORY_LABELS[filter]}
						</Badge>
					</Link>
				))}
			</div>

			<section className="space-y-4">
				<div>
					<h2 className="text-sm font-semibold">My posts</h2>
					<p className="text-xs text-muted-foreground">
						Review responses, edit details, and close or delete openings you manage.
					</p>
				</div>

				{myPosts.length === 0 ? (
					<div className="border border-dashed px-6 py-10 text-center">
						<p className="text-sm font-medium">No recruiting posts yet</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Publish your first post to replace the old Discord recruiting flow.
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{myPosts.map((post) => (
							<RecruitmentPostCard
								key={post.id}
								post={post}
								currentUserId={user.id}
								entityOptions={entityOptions}
								responses={myResponsesByPost.get(post.id) ?? []}
								teamId={post.teamId ?? undefined}
								organizationId={post.organizationId ?? undefined}
							/>
						))}
					</div>
				)}
			</section>

			<section className="space-y-4">
				<div>
					<h2 className="text-sm font-semibold">My responses</h2>
					<p className="text-xs text-muted-foreground">
						Track every application or contact thread you have already started.
					</p>
				</div>
				<RecruitmentSentResponsesPanel responses={myResponses} />
			</section>

			<section className="space-y-4">
				<div>
					<h2 className="text-sm font-semibold">Discover posts</h2>
					<p className="text-xs text-muted-foreground">
						Browse live recruiting posts across players, teams, and organisations.
					</p>
				</div>

				{discoverPosts.length === 0 ? (
					<div className="border border-dashed px-6 py-10 text-center">
						<p className="text-sm font-medium">No posts match this filter</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Try a different category filter or create a post of your own.
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{discoverPosts.map((post) => (
							<RecruitmentPostCard
								key={post.id}
								post={post}
								currentUserId={user.id}
								entityOptions={entityOptions}
							/>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
