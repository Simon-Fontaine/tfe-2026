import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";

import { RecruitmentPostCard } from "@/components/recruit/recruitment-post-card";
import { RecruitmentPostFormDialog } from "@/components/recruit/recruitment-post-form-dialog";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";
import { getRecruitmentResponsesForPost } from "@/lib/data/recruit";

export default async function OrgPostsPage({ params }: { params: Promise<{ orgId: string }> }) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId } = await params;
	const org = await getOrgWithTeams(orgId, user.id);
	if (!org) notFound();

	const canManage = org.currentUser.canManage;
	const responsesByPost = new Map(
		await Promise.all(
			org.ownedPosts.map(
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
						Publish staff openings or other organisation-owned recruiting needs.
					</p>
				</div>
				{canManage && (
					<RecruitmentPostFormDialog fixedOwnerType="organization" fixedOrganizationId={org.id}>
						<Button size="sm">
							<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1.5 size-4" />
							New post
						</Button>
					</RecruitmentPostFormDialog>
				)}
			</div>

			{org.ownedPosts.length === 0 ? (
				<div className="border border-dashed px-6 py-10 text-center">
					<p className="text-sm font-medium">No organisation posts yet</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Post staff openings here instead of relying on Discord channels.
					</p>
				</div>
			) : (
				<div className="space-y-4">
					{org.ownedPosts.map((post) => (
						<RecruitmentPostCard
							key={post.id}
							post={post}
							currentUserId={user.id}
							responses={responsesByPost.get(post.id) ?? []}
							organizationId={org.id}
						/>
					))}
				</div>
			)}
		</>
	);
}
