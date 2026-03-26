import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";

import { RecruitmentPostCard } from "@/components/recruit/recruitment-post-card";
import { RecruitmentPostFormDialog } from "@/components/recruit/recruitment-post-form-dialog";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getRecruitmentResponsesForPost } from "@/lib/data/recruit";
import { getTeamWithRoster } from "@/lib/data/teams";

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
		<>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-bold">Posts</h1>
					<p className="text-xs text-muted-foreground">
						Publish openings for players, ringers, and team staff from this workspace.
					</p>
				</div>
				{canManage && (
					<RecruitmentPostFormDialog fixedOwnerType="team" fixedTeamId={team.id}>
						<Button size="sm">
							<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
							New post
						</Button>
					</RecruitmentPostFormDialog>
				)}
			</div>

			{team.ownedPosts.length === 0 ? (
				<div className="border border-dashed px-6 py-10 text-center">
					<p className="text-sm font-medium">No team posts yet</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Create a post here to replace Discord recruiting threads for this team.
					</p>
				</div>
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
						/>
					))}
				</div>
			)}
		</>
	);
}
