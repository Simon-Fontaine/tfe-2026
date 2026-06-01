"use client";

import type { ChatConversationSummary, ChatMessage } from "@scrimflow/shared";
import { useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";
import { apiRoutes } from "@/lib/routes";
import { chatSocket } from "@/lib/ws/chat-socket";
import { useChatStore } from "@/stores/chat";
import { MessageInput } from "./message-input";
import { MessageList } from "./message-list";

const EMPTY_MESSAGES: ChatMessage[] = [];

interface MessagePaneProps {
	conversationId: string;
	currentUserId: string;
	conversation: ChatConversationSummary | undefined;
	isArchived?: boolean;
}

export function MessagePane({
	conversationId,
	currentUserId,
	conversation,
	isArchived,
}: MessagePaneProps) {
	const { setMessages, appendMessage, clearUnread } = useChatStore();
	const messages = useChatStore((s) => s.messages[conversationId] ?? EMPTY_MESSAGES);
	const isLoading = useChatStore(
		(s) => s.messages[conversationId] === undefined && s.loadingOlder[conversationId] !== false
	);
	const lastPersistedReadRef = useRef<string | null>(null);
	const previousConversationRef = useRef<string | null>(null);

	// Load initial messages for this conversation
	useEffect(() => {
		const store = useChatStore.getState();
		// Skip if already loaded
		if (store.messages[conversationId]) return;

		let cancelled = false;
		void fetch(apiRoutes.chat.messages(conversationId), { credentials: "include" })
			.then(async (res) => {
				if (cancelled || !res.ok) return;
				const json = (await res.json()) as {
					data?: { items: ChatMessage[]; nextCursor: string | null };
				};
				if (json.data && !cancelled) {
					setMessages(conversationId, json.data.items, json.data.nextCursor);
				}
			})
			.catch(() => {
				if (!cancelled) setMessages(conversationId, [], null);
			});

		return () => {
			cancelled = true;
		};
	}, [conversationId, setMessages]);

	// Subscribe to WebSocket conversation room
	useEffect(() => {
		chatSocket.subscribe(conversationId);
		return () => {
			chatSocket.unsubscribe(conversationId);
		};
	}, [conversationId]);

	// Clear unread badge when pane becomes active
	useEffect(() => {
		if (previousConversationRef.current !== conversationId) {
			previousConversationRef.current = conversationId;
			lastPersistedReadRef.current = null;
		}

		clearUnread(conversationId);

		const lastMessageId = messages[messages.length - 1]?.id;
		if (!lastMessageId || lastMessageId.startsWith("temp-")) return;
		if (lastPersistedReadRef.current === lastMessageId) return;

		lastPersistedReadRef.current = lastMessageId;
		void fetch(apiRoutes.chat.read(conversationId), {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ lastReadMessageId: lastMessageId }),
		}).catch(() => {
			lastPersistedReadRef.current = null;
		});
	}, [conversationId, messages, clearUnread]);

	async function handleSend(content: string) {
		// Optimistic: add a temp message immediately
		const clientNonce = crypto.randomUUID();
		const tempId = `temp-${clientNonce}`;
		const optimisticMessage: ChatMessage = {
			id: tempId,
			conversationId,
			senderId: currentUserId,
			senderDisplayName: "You",
			senderAvatarUrl: null,
			content,
			replyToMessageId: null,
			isSystemMessage: false,
			editedAt: null,
			deletedAt: null,
			createdAt: new Date().toISOString(),
			clientNonce,
		};
		appendMessage(conversationId, optimisticMessage);

		try {
			const res = await fetch(apiRoutes.chat.messages(conversationId), {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content, clientNonce }),
			});
			if (!res.ok) {
				// Remove the optimistic message on failure
				useChatStore.getState().deleteMessage(conversationId, tempId, new Date().toISOString());
			}
			// On success, the WS event `message:new` will arrive and the real message
			// will be appended — the optimistic message stays until then (dedup by id handled in store).
		} catch {
			useChatStore.getState().deleteMessage(conversationId, tempId, new Date().toISOString());
		}
	}

	if (isLoading) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<Spinner />
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="border-b px-4 py-3">
				<p className="text-sm font-semibold">{conversation?.name ?? "Conversation"}</p>
				{conversation ? (
					<p className="text-xs text-muted-foreground">
						{conversation.participantCount} participant
						{conversation.participantCount !== 1 ? "s" : ""}
						{conversation.isArchived ? " · Archived (read-only)" : ""}
					</p>
				) : null}
			</div>

			<MessageList conversationId={conversationId} currentUserId={currentUserId} />

			{(() => {
				const effectivelyArchived = isArchived ?? conversation?.isArchived;
				if (effectivelyArchived) {
					return (
						<div className="border-t px-4 py-3">
							<p className="text-center text-xs text-muted-foreground">
								This conversation is archived — sending is disabled.
							</p>
						</div>
					);
				}
				if (effectivelyArchived === false) {
					return <MessageInput conversationId={conversationId} onSend={handleSend} />;
				}
				return null;
			})()}
		</div>
	);
}
