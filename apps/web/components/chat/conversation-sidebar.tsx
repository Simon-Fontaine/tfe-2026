"use client";

import type { ChatConversationSummary } from "@scrimflow/shared";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat";

interface ConversationSidebarProps {
	initialConversations: ChatConversationSummary[];
	selectedConversationId: string | null;
	onSelect: (id: string) => void;
}

export function ConversationSidebar({
	initialConversations,
	selectedConversationId,
	onSelect,
}: ConversationSidebarProps) {
	const { conversations, setConversations } = useChatStore();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	// Hydrate the store with server-fetched data on first render
	useEffect(() => {
		if (conversations.length === 0 && initialConversations.length > 0) {
			setConversations(initialConversations);
		}
	}, [initialConversations, conversations.length, setConversations]);

	// Sync selected conversation to URL search param
	useEffect(() => {
		const currentParam = searchParams.get("conversation");
		if (currentParam === selectedConversationId) return;
		const params = new URLSearchParams(searchParams.toString());
		if (selectedConversationId) {
			params.set("conversation", selectedConversationId);
		} else {
			params.delete("conversation");
		}
		const query = params.toString();
		router.replace(query ? `${pathname}?${query}` : pathname);
	}, [pathname, router, searchParams, selectedConversationId]);

	const list = conversations.length > 0 ? conversations : initialConversations;

	return (
		<div className="flex flex-col space-y-1 overflow-y-auto border p-2">
			{list.map((conversation) => (
				<ConversationItem
					key={conversation.id}
					conversation={conversation}
					isSelected={selectedConversationId === conversation.id}
					onSelect={onSelect}
				/>
			))}
		</div>
	);
}

function ConversationItem({
	conversation,
	isSelected,
	onSelect,
}: {
	conversation: ChatConversationSummary;
	isSelected: boolean;
	onSelect: (id: string) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onSelect(conversation.id)}
			className={cn(
				"w-full border px-3 py-2 text-left transition-colors hover:bg-muted",
				isSelected && "border-primary bg-primary/5"
			)}
		>
			<div className="flex items-center justify-between gap-2">
				<p className="line-clamp-1 text-sm font-medium">{conversation.name}</p>
				{conversation.unreadCount > 0 ? (
					<Badge className="min-w-5 justify-center px-1 text-[10px]">
						{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
					</Badge>
				) : null}
			</div>
			{conversation.lastMessagePreview ? (
				<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
					{conversation.lastMessagePreview}
				</p>
			) : (
				<p className="mt-1 text-xs text-muted-foreground/60">No messages yet.</p>
			)}
		</button>
	);
}
