"use client";

import type { ChatMessage } from "@scrimflow/shared";
import { useCallback, useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";
import { apiRoutes } from "@/lib/routes";
import { useChatStore } from "@/stores/chat";
import { MessageBubble } from "./message-bubble";

const EMPTY_MESSAGES: ChatMessage[] = [];

interface MessageListProps {
	conversationId: string;
	currentUserId: string;
}

export function MessageList({ conversationId, currentUserId }: MessageListProps) {
	const messages = useChatStore((s) => s.messages[conversationId] ?? EMPTY_MESSAGES);
	const nextCursor = useChatStore((s) => s.nextCursors[conversationId]);
	const isLoadingOlder = useChatStore((s) => s.loadingOlder[conversationId] ?? false);
	const { prependMessages, setLoadingOlder, updateMessage, deleteMessage } = useChatStore();

	const bottomRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const isAtBottomRef = useRef(true);
	const listRef = useRef<HTMLDivElement>(null);
	const latestMessageId = messages[messages.length - 1]?.id;

	// Auto-scroll to bottom on new messages (only when already near bottom)
	useEffect(() => {
		if (!latestMessageId) return;
		if (isAtBottomRef.current) {
			bottomRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [latestMessageId]);

	// Track scroll position to decide whether to auto-scroll
	function handleScroll() {
		const el = listRef.current;
		if (!el) return;
		const threshold = 80;
		isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
	}

	// Infinite scroll — load older messages when top sentinel is visible
	const loadOlder = useCallback(async () => {
		if (!nextCursor || isLoadingOlder) return;
		setLoadingOlder(conversationId, true);
		try {
			const url = `${apiRoutes.chat.messages(conversationId)}?cursor=${encodeURIComponent(nextCursor)}&limit=30`;
			const res = await fetch(url, { credentials: "include" });
			if (!res.ok) return;
			const json = (await res.json()) as {
				data?: { items: ChatMessage[]; nextCursor: string | null };
			};
			if (json.data) {
				prependMessages(conversationId, json.data.items, json.data.nextCursor);
			}
		} finally {
			setLoadingOlder(conversationId, false);
		}
	}, [conversationId, nextCursor, isLoadingOlder, prependMessages, setLoadingOlder]);

	// IntersectionObserver on top sentinel
	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && nextCursor && !isLoadingOlder) {
					void loadOlder();
				}
			},
			{ threshold: 0.1 }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [loadOlder, nextCursor, isLoadingOlder]);

	// Mark conversation read when messages are visible.
	// Skip temp-* optimistic IDs — use the last real message instead so a pending
	// optimistic send doesn't permanently block the read receipt.
	useEffect(() => {
		const lastRealMessage = [...messages].reverse().find((m) => !m.id.startsWith("temp-"));
		if (!lastRealMessage) return;
		void fetch(apiRoutes.chat.read(conversationId), {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ lastReadMessageId: lastRealMessage.id }),
		});
	}, [messages, conversationId]);

	async function handleEdit(messageId: string, newContent: string) {
		// Optimistic update
		const existing = messages.find((m) => m.id === messageId);
		if (!existing) return;
		updateMessage(conversationId, {
			...existing,
			content: newContent,
			editedAt: new Date().toISOString(),
		});

		const res = await fetch(apiRoutes.chat.message(conversationId, messageId), {
			method: "PATCH",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: newContent }),
		});
		if (!res.ok) {
			// Revert
			updateMessage(conversationId, existing);
		}
	}

	async function handleDelete(messageId: string) {
		const now = new Date().toISOString();
		// Optimistic update
		deleteMessage(conversationId, messageId, now);

		const res = await fetch(apiRoutes.chat.message(conversationId, messageId), {
			method: "DELETE",
			credentials: "include",
		});
		if (!res.ok) {
			// Revert — re-fetch would be ideal but for now just mark as not deleted
			const existing = messages.find((m) => m.id === messageId);
			if (existing) updateMessage(conversationId, { ...existing, deletedAt: null });
		}
	}

	return (
		<div ref={listRef} onScroll={handleScroll} className="flex flex-1 flex-col overflow-y-auto p-4">
			{/* Top sentinel for infinite scroll */}
			<div ref={sentinelRef} className="h-px" />

			{isLoadingOlder ? (
				<div className="flex justify-center py-2">
					<Spinner />
				</div>
			) : null}

			{nextCursor === null && messages.length > 0 ? (
				<p className="py-2 text-center text-[11px] text-muted-foreground">
					Beginning of conversation
				</p>
			) : null}

			<div className="space-y-3 py-2">
				{messages.map((msg) => (
					<MessageBubble
						key={msg.id}
						message={msg}
						currentUserId={currentUserId}
						onEdit={handleEdit}
						onDelete={handleDelete}
					/>
				))}
			</div>

			<div ref={bottomRef} />
		</div>
	);
}
