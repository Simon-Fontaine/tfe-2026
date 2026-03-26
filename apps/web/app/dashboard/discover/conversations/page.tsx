import Link from "next/link";

import { RecruitmentThreadPanel } from "@/components/recruit/recruitment-thread-panel";
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
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			<div>
				<h1 className="text-lg font-bold">Recruit Conversations</h1>
				<p className="text-xs text-muted-foreground">Manage every recruiting thread in one inbox</p>
			</div>

			<div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
				<div className="space-y-3">
					<h2 className="text-sm font-semibold">Threads</h2>
					{conversations.length === 0 ? (
						<div className="flex min-h-[240px] items-center justify-center border border-dashed px-6 text-center">
							<p className="text-sm text-muted-foreground">
								No conversations yet. Respond to a post to create the first thread.
							</p>
						</div>
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
				</div>

				<RecruitmentThreadPanel thread={thread} currentUserId={user.id} />
			</div>
		</div>
	);
}
