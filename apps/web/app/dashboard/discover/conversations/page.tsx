import Link from "next/link";

import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSection } from "@/components/dashboard/page-section";
import { RecruitmentThreadPanel } from "@/components/recruit/recruitment-thread-panel";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Badge } from "@/components/ui/badge";
import { getCurrentSession } from "@/lib/auth/session";
import { getRecruitmentConversations, getRecruitmentThread } from "@/lib/data/recruit";
import { RECRUITMENT_CATEGORY_LABELS } from "@/lib/recruitment";
import { dashboardRoutes } from "@/lib/routes";

interface RecruitConversationsPageProps {
	searchParams: Promise<{ thread?: string }>;
}

export default async function RecruitConversationsPage({
	searchParams,
}: RecruitConversationsPageProps) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { thread: threadId } = await searchParams;
	const conversations = await getRecruitmentConversations();
	const selectedThreadId = threadId ?? conversations[0]?.threadId ?? null;
	const thread = selectedThreadId ? await getRecruitmentThread(selectedThreadId) : null;

	return (
		<PageContainer>
			<PageHeader
				title="Recruit Conversations"
				description="Manage every recruiting thread in one inbox"
			/>

			<div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
				<PageSection title="Threads">
					{conversations.length === 0 ? (
						<EmptyStateBlock
							title="No conversations yet"
							description="Respond to a post to create the first thread."
							variant="card"
						/>
					) : (
						<div className="space-y-2">
							{conversations.map((conversation) => {
								const isSelected = conversation.threadId === selectedThreadId;
								return (
									<Link
										key={conversation.threadId}
										href={`${dashboardRoutes.discover.conversations}?thread=${conversation.threadId}`}
										className={`block border p-3 transition-colors hover:bg-muted/50 ${
											isSelected ? "border-primary bg-primary/5" : ""
										}`}
									>
										<div className="flex flex-wrap items-center gap-2">
											<p className="truncate text-sm font-medium">
												{conversation.counterpartLabel}
											</p>
											<Badge variant="secondary" className="text-[10px]">
												{RECRUITMENT_CATEGORY_LABELS[conversation.postCategory]}
											</Badge>
										</div>
										<p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
											{conversation.postTitle}
										</p>
										{conversation.lastMessagePreview && (
											<p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
												{conversation.lastMessagePreview}
											</p>
										)}
									</Link>
								);
							})}
						</div>
					)}
				</PageSection>

				<RecruitmentThreadPanel thread={thread} currentUserId={user.id} />
			</div>
		</PageContainer>
	);
}
