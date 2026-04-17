"use client";

import { MessageNotification02Icon } from "@hugeicons/core-free-icons";
import type { ChatConversationSummary } from "@scrimflow/shared";
import { useEffect, useState } from "react";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useChatStore } from "@/stores/chat";
import { ConversationSidebar } from "./conversation-sidebar";
import { MessagePane } from "./message-pane";

interface ChatWorkspaceProps {
	contextKey?: string;
	currentUserId: string;
	conversations: ChatConversationSummary[];
	emptyTitle: string;
	emptyDescription: string;
	initialConversationId?: string | null;
}

export function ChatWorkspace({
	contextKey,
	currentUserId,
	conversations,
	emptyTitle,
	emptyDescription,
	initialConversationId,
}: ChatWorkspaceProps) {
	const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
		initialConversationId && conversations.some((c) => c.id === initialConversationId)
			? initialConversationId
			: (conversations[0]?.id ?? null)
	);

	// Initialise the shared WebSocket connection
	useChatSocket();

	const storeConversations = useChatStore((s) => s.conversations);
	const list = storeConversations.length > 0 ? storeConversations : conversations;
	const selectedConversation = list.find((c) => c.id === selectedConversationId);

	useEffect(() => {
		const nextSelectedConversationId =
			initialConversationId &&
			conversations.some((conversation) => conversation.id === initialConversationId)
				? initialConversationId
				: (conversations[0]?.id ?? null);

		if (
			!selectedConversationId ||
			!conversations.some((conversation) => conversation.id === selectedConversationId)
		) {
			setSelectedConversationId(nextSelectedConversationId);
		}
	}, [conversations, initialConversationId, selectedConversationId]);

	if (conversations.length === 0) {
		return (
			<EmptyStateBlock
				icon={MessageNotification02Icon}
				title={emptyTitle}
				description={emptyDescription}
				variant="card"
			/>
		);
	}

	return (
		<div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
			<ConversationSidebar
				key={contextKey ?? "default"}
				initialConversations={conversations}
				selectedConversationId={selectedConversationId}
				onSelect={setSelectedConversationId}
			/>

			{selectedConversationId ? (
				<div className="flex min-h-[520px] flex-col border">
					<MessagePane
						conversationId={selectedConversationId}
						currentUserId={currentUserId}
						conversation={selectedConversation}
					/>
				</div>
			) : (
				<div className="flex min-h-[520px] items-center justify-center border">
					<p className="text-sm text-muted-foreground">Select a conversation.</p>
				</div>
			)}
		</div>
	);
}
