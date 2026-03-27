import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { RecruitmentPostCard } from "@/components/recruit/recruitment-post-card";
import { RecruitmentPostFormDialog } from "@/components/recruit/recruitment-post-form-dialog";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getRecruitmentResponsesForPost } from "@/lib/data/recruit";
import { getTeamWithRoster } from "@/lib/data/teams";
import { dashboardRoutes } from "@/lib/routes";

interface TeamPostsPageProps {
	params: Promise<{ orgId: string; teamId: string }>;
}

export default async function TeamPostsPage({ params }: TeamPostsPageProps) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId, teamId } = await params;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team || team.organizationId !== orgId) notFound();

	const canManage = team.currentUser.canManage;
	const responsesByPost = new Map(
		await Promise.all(
			team.ownedPosts.map(
				async (post) => [post.id, await getRecruitmentResponsesForPost(post.id)] as const
			)
		)
	);

	return (
		<PageContainer>
			<PageHeader
				title="Posts"
				description="Publish openings for players, ringers, and team staff from this workspace."
				actions={
					canManage ? (
						<RecruitmentPostFormDialog fixedOwnerType="team" fixedTeamId={team.id}>
							<Button size="sm">
								<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
								New post
							</Button>
						</RecruitmentPostFormDialog>
					) : undefined
				}
			/>

			{team.ownedPosts.length === 0 ? (
				<EmptyStateBlock
					title="No team posts yet"
					description="Create a post here to replace Discord recruiting threads for this team."
					variant="card"
				/>
			) : (
				<div className="space-y-4">
					{team.ownedPosts.map((post) => (
						<RecruitmentPostCard
							key={post.id}
							post={post}
							currentUserId={user.id}
							responses={responsesByPost.get(post.id) ?? []}
							teamId={team.id}
							organizationId={team.organizationId}
							conversationHrefBase={dashboardRoutes.context.teamConversations(orgId, team.id)}
						/>
					))}
				</div>
			)}
		</PageContainer>
	);
}
