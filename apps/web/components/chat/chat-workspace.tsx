"use client";

import { MessageNotification02Icon } from "@hugeicons/core-free-icons";
import type {
	ChatConversationDetail,
	ChatConversationSummary,
	ChatParticipantSummary,
} from "@scrimflow/shared";
import { apiRoutes } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { realtimeSocket } from "@/lib/ws/realtime-socket";
import { selectOrderedConversations, useChatStore } from "@/stores/chat";
import { ConversationMembers } from "./conversation-members";
import { ConversationSidebar } from "./conversation-sidebar";
import { MessagePane } from "./message-pane";

const EMPTY_PARTICIPANTS: ChatParticipantSummary[] = [];

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
	// Initialise the shared WebSocket connection
	useChatSocket();
	const router = useRouter();

	const wasConnectedRef = useRef<boolean | null>(null);

	const conversationsById = useChatStore((s) => s.conversationsById);
	const mergeConversations = useChatStore((s) => s.mergeConversations);

	// The server scopes this context's conversations (team room + its scrim
	// channels). We render exactly that id set — never re-derived from teamId.
	const orderedIds = useMemo(() => conversations.map((c) => c.id), [conversations]);

	useEffect(() => {
		mergeConversations(conversations);
	}, [conversations, mergeConversations]);

	const list = useMemo(() => {
		const live = selectOrderedConversations(conversationsById, orderedIds);
		return live.length > 0 ? live : conversations;
	}, [conversationsById, orderedIds, conversations]);

	const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
		initialConversationId && conversations.some((c) => c.id === initialConversationId)
			? initialConversationId
			: (conversations[0]?.id ?? null)
	);
	const selectedConversationIdRef = useRef(selectedConversationId);
	selectedConversationIdRef.current = selectedConversationId;

	const selectedConversation = list.find((c) => c.id === selectedConversationId);

	// Fetch the selected conversation's participants (with username + presence
	// status) for the member rail and typing-indicator names.
	const [participants, setParticipants] = useState<ChatParticipantSummary[]>(EMPTY_PARTICIPANTS);
	const loadParticipants = useCallback((conversationId: string | null) => {
		if (!conversationId) {
			setParticipants(EMPTY_PARTICIPANTS);
			return;
		}
		void fetch(apiRoutes.chat.byId(conversationId), { credentials: "include" })
			.then(async (res) => {
				if (!res.ok) return;
				const json = (await res.json()) as { data?: ChatConversationDetail };
				// Ignore if the user switched conversations while the request was in flight.
				if (json.data && selectedConversationIdRef.current === conversationId) {
					setParticipants(json.data.participants);
					// Seed presence immediately; live changes still arrive via presence:update.
					useChatStore.getState().setPresences(
						json.data.participants.map((participant) => ({
							userId: participant.userId,
							status: participant.status,
							lastSeenAt: null,
						}))
					);
				}
			})
			.catch(() => {
				/* best-effort — member rail just stays empty */
			});
	}, []);

	useEffect(() => {
		loadParticipants(selectedConversationId);
	}, [selectedConversationId, loadParticipants]);

	// Resync conversations + presence on a genuine drop→reconnect (not initial connect).
	useEffect(() => {
		return realtimeSocket.addConnectionListener((connected) => {
			if (wasConnectedRef.current === false && connected) {
				startTransition(() => router.refresh());
				loadParticipants(selectedConversationIdRef.current);
			}
			wasConnectedRef.current = connected;
		});
	}, [router, loadParticipants]);

	useEffect(() => {
		const nextSelectedConversationId =
			initialConversationId &&
			list.some((conversation) => conversation.id === initialConversationId)
				? initialConversationId
				: (list[0]?.id ?? null);

		if (
			!selectedConversationId ||
			!list.some((conversation) => conversation.id === selectedConversationId)
		) {
			setSelectedConversationId(nextSelectedConversationId);
		}
	}, [list, initialConversationId, selectedConversationId]);

	if (list.length === 0) {
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
		<div className="grid min-h-[480px] gap-4 lg:h-[calc(100dvh-13rem)] lg:grid-cols-[260px_minmax(0,1fr)_minmax(200px,240px)]">
			<ConversationSidebar
				key={contextKey ?? "default"}
				conversations={list}
				selectedConversationId={selectedConversationId}
				onSelect={setSelectedConversationId}
				className="border"
			/>

			{selectedConversationId ? (
				<div className="flex min-h-0 flex-col border">
					<MessagePane
						conversationId={selectedConversationId}
						currentUserId={currentUserId}
						conversation={selectedConversation}
						participants={participants}
					/>
				</div>
			) : (
				<div className="flex min-h-0 items-center justify-center border">
					<p className="text-sm text-muted-foreground">Select a conversation.</p>
				</div>
			)}

			<div className="hidden min-h-0 lg:block">
				<ConversationMembers participants={participants} />
			</div>
		</div>
	);
}
