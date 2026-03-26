import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSection } from "@/components/dashboard/page-section";
import { RecruitmentPostCard } from "@/components/recruit/recruitment-post-card";
import { RecruitmentPostFormDialog } from "@/components/recruit/recruitment-post-form-dialog";
import { RecruitmentSentResponsesPanel } from "@/components/recruit/recruitment-sent-responses-panel";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
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
		<PageContainer>
			<PageHeader
				title="Recruit Posts"
				description="Publish, manage, and browse LFT, LFP, LFR, and LFS posts"
				actions={
					<RecruitmentPostFormDialog ownerOptions={entityOptions}>
						<Button size="sm">
							<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
							New post
						</Button>
					</RecruitmentPostFormDialog>
				}
			/>

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

			<PageSection
				title="My posts"
				description="Review responses, edit details, and close or delete openings you manage."
			>
				{myPosts.length === 0 ? (
					<EmptyStateBlock
						title="No recruiting posts yet"
						description="Publish your first post to replace the old Discord recruiting flow."
						variant="card"
					/>
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
			</PageSection>

			<PageSection
				title="My responses"
				description="Track every application or contact thread you have already started."
			>
				<RecruitmentSentResponsesPanel responses={myResponses} />
			</PageSection>

			<PageSection
				title="Discover posts"
				description="Browse live recruiting posts across players, teams, and organisations."
			>
				{discoverPosts.length === 0 ? (
					<EmptyStateBlock
						title="No posts match this filter"
						description="Try a different category filter or create a post of your own."
						variant="card"
					/>
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
			</PageSection>
		</PageContainer>
	);
}
