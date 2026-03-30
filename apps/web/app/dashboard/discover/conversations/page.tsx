import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getChatConversations } from "@/lib/data/chat";

interface DiscoverChatPageProps {
	searchParams: Promise<{ conversation?: string }>;
}

export default async function DiscoverChatPage({ searchParams }: DiscoverChatPageProps) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { conversation } = await searchParams;
	const conversations = await getChatConversations();

	return (
		<PageContainer>
			<PageHeader title="Chat" description="Manage all conversations in one inbox." />
			<ChatWorkspace
				currentUserId={user.id}
				conversations={conversations}
				initialConversationId={conversation ?? null}
				emptyTitle="No conversations yet"
				emptyDescription="Respond to a post or join a team conversation to get started."
			/>
		</PageContainer>
	);
}
