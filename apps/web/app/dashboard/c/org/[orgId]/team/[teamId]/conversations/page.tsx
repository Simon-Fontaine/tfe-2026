import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSection } from "@/components/dashboard/page-section";
import { RecruitmentThreadPanel } from "@/components/recruit/recruitment-thread-panel";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Badge } from "@/components/ui/badge";
import { getCurrentSession } from "@/lib/auth/session";
import { getRecruitmentConversations, getRecruitmentThread } from "@/lib/data/recruit";
import { getTeamWithRoster } from "@/lib/data/teams";
import { RECRUITMENT_CATEGORY_LABELS } from "@/lib/recruitment";
import { dashboardRoutes, publicRoutes } from "@/lib/routes";

interface TeamConversationsPageProps {
	params: Promise<{ orgId: string; teamId: string }>;
	searchParams: Promise<{ thread?: string }>;
}

export default async function TeamConversationsPage({
	params,
	searchParams,
}: TeamConversationsPageProps) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId, teamId } = await params;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team || team.organizationId !== orgId) notFound();

	const { thread: threadParam } = await searchParams;
	const conversations = (await getRecruitmentConversations()).filter(
		(conversation) => conversation.teamId === team.id
	);
	const selectedThreadId = conversations.some(
		(conversation) => conversation.threadId === threadParam
	)
		? threadParam
		: (conversations[0]?.threadId ?? null);
	const thread = selectedThreadId ? await getRecruitmentThread(selectedThreadId) : null;
	const activeThread = thread && thread.post.teamId === team.id ? thread : null;

	return (
		<PageContainer>
			<PageHeader title="Conversations" description={`Recruiting threads for ${team.name}.`} />

			<div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
				<PageSection title="Threads">
					{conversations.length === 0 ? (
						<EmptyStateBlock
							title="No team conversations yet"
							description="Responses to team posts will appear here."
							variant="card"
						/>
					) : (
						<div className="space-y-2">
							{conversations.map((conversation) => {
								const isSelected = conversation.threadId === selectedThreadId;
								const profileHref =
									conversation.counterpartType === "player" && conversation.counterpartUsername
										? publicRoutes.players.byUsername(conversation.counterpartUsername)
										: conversation.counterpartType === "organization" &&
												conversation.counterpartOrgSlug
											? publicRoutes.orgs.bySlug(conversation.counterpartOrgSlug)
											: conversation.counterpartType === "team" && conversation.teamId
												? publicRoutes.teams.byId(conversation.teamId)
												: null;
								return (
									<div
										key={conversation.threadId}
										className={`border transition-colors ${isSelected ? "border-primary" : ""}`}
									>
										<div className="flex flex-wrap items-center gap-2 px-3 pt-3">
											{profileHref ? (
												<Link
													href={profileHref}
													className="truncate text-sm font-medium hover:underline"
												>
													{conversation.counterpartLabel}
												</Link>
											) : (
												<p className="truncate text-sm font-medium">
													{conversation.counterpartLabel}
												</p>
											)}
											<Badge variant="secondary" className="text-[10px]">
												{RECRUITMENT_CATEGORY_LABELS[conversation.postCategory]}
											</Badge>
										</div>
										<Link
											href={`${dashboardRoutes.context.teamConversations(orgId, team.id)}?thread=${conversation.threadId}`}
											className={`block px-3 pb-3 pt-1 hover:bg-muted/50 ${
												isSelected ? "bg-primary/5" : ""
											}`}
										>
											<p className="line-clamp-1 text-xs text-muted-foreground">
												{conversation.postTitle}
											</p>
											{conversation.lastMessagePreview && (
												<p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
													{conversation.lastMessagePreview}
												</p>
											)}
										</Link>
									</div>
								);
							})}
						</div>
					)}
				</PageSection>

				<RecruitmentThreadPanel thread={activeThread} currentUserId={user.id} />
			</div>
		</PageContainer>
	);
}
