"use client";

import { MessageNotification02Icon } from "@hugeicons/core-free-icons";
import type { ChatConversationSummary, ChatMessage, ChatRealtimeEvent } from "@scrimflow/shared";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { apiRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type ChatWorkspaceProps = {
	currentUserId: string;
	conversations: ChatConversationSummary[];
	emptyTitle: string;
	emptyDescription: string;
	initialConversationId?: string | null;
};

export function ChatWorkspace({
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
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [message, setMessage] = useState("");
	const [isLoadingMessages, setIsLoadingMessages] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);
	const wsRef = useRef<WebSocket | null>(null);
	const subscribedConversationRef = useRef<string | null>(null);
	const pendingConversationSubscriptionRef = useRef<string | null>(null);
	const selectedConversationIdRef = useRef<string | null>(selectedConversationId);
	const typingTimeoutRef = useRef<number | null>(null);
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const selectedConversation = useMemo(
		() => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
		[selectedConversationId, conversations]
	);

	useEffect(() => {
		selectedConversationIdRef.current = selectedConversationId;
	}, [selectedConversationId]);

	useEffect(() => {
		if (!selectedConversationId) {
			setMessages([]);
			return;
		}

		let cancelled = false;
		setIsLoadingMessages(true);
		void fetch(apiRoutes.chat.messages(selectedConversationId), { credentials: "include" })
			.then(async (response) => {
				const payload = (await response.json()) as {
					data?: { items: ChatMessage[] };
					error?: string;
				};
				if (cancelled) return;
				if (!response.ok || !payload.data)
					throw new Error(payload.error ?? "Unable to load messages.");
				setError(null);
				setMessages(payload.data.items);
			})
			.catch((fetchError) => {
				if (cancelled) return;
				setError(fetchError instanceof Error ? fetchError.message : "Unable to load messages.");
				setMessages([]);
			})
			.finally(() => {
				if (!cancelled) setIsLoadingMessages(false);
			});

		return () => {
			cancelled = true;
		};
	}, [selectedConversationId]);

	useEffect(() => {
		const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
		const ws = new WebSocket(`${wsProtocol}://${window.location.host}${apiRoutes.chat.ws}`);
		wsRef.current = ws;

		ws.onopen = () => {
			const conversationId = pendingConversationSubscriptionRef.current;
			if (!conversationId) return;
			ws.send(JSON.stringify({ type: "subscribe", conversationId }));
			subscribedConversationRef.current = conversationId;
			pendingConversationSubscriptionRef.current = null;
		};

		ws.onmessage = (event) => {
			const raw = String(event.data);
			let data: ChatRealtimeEvent | null = null;
			try {
				data = JSON.parse(raw) as ChatRealtimeEvent;
			} catch {
				return;
			}
			if (!data) return;
			if (data.type === "conversation.message.created" && data.message) {
				if (data.conversationId !== selectedConversationIdRef.current) return;
				setMessages((current) => [...current, data.message as ChatMessage]);
			}
			if (
				data.type === "conversation.typing" &&
				data.conversationId === selectedConversationIdRef.current
			) {
				setTypingUserIds((current) => {
					if (data.isTyping)
						return current.includes(data.userId) ? current : [...current, data.userId];
					return current.filter((id) => id !== data.userId);
				});
			}
		};

		return () => {
			ws.close();
			wsRef.current = null;
			subscribedConversationRef.current = null;
			pendingConversationSubscriptionRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!selectedConversationId) return;
		const ws = wsRef.current;
		if (!ws) return;
		if (ws.readyState === WebSocket.CONNECTING) {
			pendingConversationSubscriptionRef.current = selectedConversationId;
			return;
		}
		if (ws.readyState !== WebSocket.OPEN) return;
		if (
			subscribedConversationRef.current &&
			subscribedConversationRef.current !== selectedConversationId
		) {
			ws.send(
				JSON.stringify({
					type: "unsubscribe",
					conversationId: subscribedConversationRef.current,
				})
			);
		}
		ws.send(JSON.stringify({ type: "subscribe", conversationId: selectedConversationId }));
		subscribedConversationRef.current = selectedConversationId;
	}, [selectedConversationId]);

	useEffect(() => {
		if (!selectedConversationId) return;
		const params = new URLSearchParams(searchParams.toString());
		params.set("conversation", selectedConversationId);
		router.replace(`${pathname}?${params.toString()}`);
	}, [pathname, router, searchParams, selectedConversationId]);

	useEffect(() => {
		if (!selectedConversationId || messages.length === 0) return;
		const lastMessage = messages[messages.length - 1];
		void fetch(apiRoutes.chat.read(selectedConversationId), {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ lastReadMessageId: lastMessage.id }),
		});
	}, [messages, selectedConversationId]);

	function emitTyping(isTyping: boolean) {
		const ws = wsRef.current;
		if (!selectedConversationId || !ws || ws.readyState !== WebSocket.OPEN) return;
		ws.send(JSON.stringify({ type: "typing", conversationId: selectedConversationId, isTyping }));
	}

	async function sendMessage() {
		if (!selectedConversationId || message.trim().length === 0) return;
		setIsSending(true);
		const content = message.trim();
		setMessage("");
		emitTyping(false);
		await fetch(apiRoutes.chat.messages(selectedConversationId), {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content }),
		});
		setError(null);
		setIsSending(false);
	}

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
			<div className="space-y-2 border p-2">
				{conversations.map((conversation) => (
					<button
						key={conversation.id}
						type="button"
						onClick={() => setSelectedConversationId(conversation.id)}
						className={cn(
							"w-full border px-3 py-2 text-left hover:bg-muted",
							selectedConversationId === conversation.id && "border-primary bg-primary/5"
						)}
					>
						<div className="flex items-center justify-between gap-2">
							<p className="line-clamp-1 text-sm font-medium">{conversation.name}</p>
							{conversation.unreadCount > 0 ? (
								<Badge className="min-w-5 justify-center px-1 text-[10px]">
									{conversation.unreadCount}
								</Badge>
							) : null}
						</div>
						<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
							{conversation.lastMessagePreview ?? "No messages yet."}
						</p>
					</button>
				))}
			</div>

			<div className="flex min-h-[420px] flex-col border">
				<div className="border-b px-4 py-3">
					<p className="text-sm font-semibold">{selectedConversation?.name ?? "Conversation"}</p>
				</div>
				<div className="flex-1 space-y-3 overflow-y-auto p-4">
					{isLoadingMessages ? <Spinner /> : null}
					{error ? <p className="text-xs text-destructive">{error}</p> : null}
					{messages.map((item) => {
						const isOwn = item.senderId === currentUserId;
						return (
							<div key={item.id} className={cn("flex gap-3", isOwn && "justify-end")}>
								{!isOwn ? (
									<Avatar className="size-8 shrink-0 overflow-hidden rounded-none after:rounded-none">
										<AvatarImage src={item.senderAvatarUrl ?? undefined} className="rounded-none" />
										<AvatarFallback className="rounded-none text-[10px] font-bold">
											{item.senderDisplayName.slice(0, 2).toUpperCase()}
										</AvatarFallback>
									</Avatar>
								) : null}
								<div
									className={cn("max-w-[80%] space-y-1 border px-3 py-2", isOwn && "bg-primary/5")}
								>
									<p className="text-[11px] font-medium">{item.senderDisplayName}</p>
									<p className="whitespace-pre-wrap text-sm">{item.content}</p>
									<p className="text-[10px] text-muted-foreground">
										{new Date(item.createdAt).toLocaleString()}
									</p>
								</div>
							</div>
						);
					})}
					{typingUserIds.length > 0 ? (
						<p className="text-xs text-muted-foreground">Someone is typing…</p>
					) : null}
				</div>
				{selectedConversation ? (
					<div className="space-y-3 border-t p-4">
						<Textarea
							value={message}
							onChange={(event) => {
								setMessage(event.target.value);
								emitTyping(event.target.value.trim().length > 0);
								if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
								typingTimeoutRef.current = window.setTimeout(() => emitTyping(false), 1200);
							}}
							rows={4}
							maxLength={2000}
							placeholder="Write your next message…"
						/>
						<div className="flex justify-end">
							<Button
								type="button"
								size="sm"
								onClick={sendMessage}
								disabled={isSending || message.trim().length === 0}
							>
								{isSending ? <Spinner className="mr-1.5" /> : null}
								Send message
							</Button>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
