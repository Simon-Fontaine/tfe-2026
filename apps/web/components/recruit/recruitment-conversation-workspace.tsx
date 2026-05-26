"use client";

import { MessageNotification02Icon } from "@hugeicons/core-free-icons";
import type { RecruitmentConversationSummary } from "@scrimflow/shared";
import { useEffect, useState } from "react";
import { MessagePane } from "@/components/chat/message-pane";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Badge } from "@/components/ui/badge";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { APPLICATION_STATUS_LABELS } from "@/lib/recruitment";
import { useChatStore } from "@/stores/chat";

interface RecruitmentConversationWorkspaceProps {
	currentUserId: string;
	conversations: RecruitmentConversationSummary[];
	initialConversationId?: string | null;
}

export function RecruitmentConversationWorkspace({
	currentUserId,
	conversations,
	initialConversationId,
}: RecruitmentConversationWorkspaceProps) {
	useChatSocket();

	const storeConversations = useChatStore((s) => s.conversations);
	const setConversations = useChatStore((s) => s.setConversations);

	// Initialise the chat store so live message events (appendMessage, clearUnread)
	// can find these conversations by id.
	useEffect(() => {
		setConversations(
			conversations.map((c) => ({
				id: c.conversationId,
				type: "recruitment" as const,
				name: c.listingTitle,
				isArchived: c.isArchived,
				scrimId: null,
				teamId: c.teamId,
				recruitmentApplicationId: c.applicationId,
				lastMessagePreview: c.lastMessagePreview,
				lastMessageAt: c.lastMessageAt,
				unreadCount: c.unreadCount,
				participantCount: 2,
			}))
		);
	}, [conversations, setConversations]);

	// Sort before computing defaultId so the pre-selected conversation matches
	// the first item the user sees in the sidebar.
	const sortedConversations = [...conversations].sort((a, b) => {
		const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
		const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
		return bTime - aTime;
	});

	const defaultId =
		initialConversationId && conversations.some((c) => c.conversationId === initialConversationId)
			? initialConversationId
			: (sortedConversations[0]?.conversationId ?? null);

	const [selectedId, setSelectedId] = useState<string | null>(defaultId);

	const selectedConversation = conversations.find((c) => c.conversationId === selectedId) ?? null;

	if (conversations.length === 0) {
		return (
			<EmptyStateBlock
				icon={MessageNotification02Icon}
				title="No recruiting conversations yet"
				description="Publish a listing or send an application to start a recruiting conversation."
			/>
		);
	}

	return (
		<div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
			{/* Sidebar */}
			<div className="divide-y overflow-hidden rounded-md border">
				{sortedConversations.map((conversation) => {
					const liveEntry = storeConversations.find((c) => c.id === conversation.conversationId);
					const unreadCount = liveEntry?.unreadCount ?? conversation.unreadCount;
					const isSelected = selectedId === conversation.conversationId;

					return (
						<button
							key={conversation.conversationId}
							type="button"
							onClick={() => setSelectedId(conversation.conversationId)}
							className={`w-full px-3 py-3 text-left transition-colors hover:bg-muted/50 ${isSelected ? "bg-muted" : ""}`}
						>
							<div className="flex items-start justify-between gap-2">
								<span className="min-w-0 truncate text-sm font-medium">
									{conversation.counterpartLabel}
								</span>
								{unreadCount > 0 && (
									<Badge variant="default" className="shrink-0 text-[10px]">
										{unreadCount}
									</Badge>
								)}
							</div>
							<p className="mt-0.5 truncate text-xs text-muted-foreground">
								{conversation.listingTitle}
							</p>
							<div className="mt-1 flex flex-wrap items-center gap-1">
								<Badge variant="outline" className="text-[10px]">
									{APPLICATION_STATUS_LABELS[conversation.applicationStatus]}
								</Badge>
								{conversation.listingStatus !== "open" && (
									<Badge variant="secondary" className="text-[10px] capitalize">
										{conversation.listingStatus}
									</Badge>
								)}
							</div>
							{conversation.lastMessagePreview && (
								<p className="mt-1 truncate text-xs text-muted-foreground/70">
									{conversation.lastMessagePreview}
								</p>
							)}
						</button>
					);
				})}
			</div>

			{/* Main pane */}
			{selectedConversation ? (
				<div className="flex min-h-[520px] flex-col overflow-hidden rounded-md border">
					<div className="border-b px-4 py-3">
						<p className="text-sm font-semibold">{selectedConversation.listingTitle}</p>
						<div className="mt-1 flex items-center gap-2">
							<Badge variant={selectedConversation.isArchived ? "secondary" : "default"}>
								{selectedConversation.isArchived ? "Archived" : "Active"}
							</Badge>
							{selectedConversation.counterpartLabel && (
								<span className="text-xs text-muted-foreground">
									with {selectedConversation.counterpartLabel}
								</span>
							)}
						</div>
						{selectedConversation.isArchived && (
							<p className="mt-1 text-xs text-muted-foreground">
								This conversation is archived and read-only.
							</p>
						)}
					</div>
					<MessagePane
						conversationId={selectedConversation.conversationId}
						currentUserId={currentUserId}
						conversation={undefined}
						isArchived={selectedConversation.isArchived}
					/>
				</div>
			) : null}
		</div>
	);
}
