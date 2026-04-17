import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getRecruitmentChatConversations } from "@/lib/data/chat";

interface AppRecruitingConversationsPageProps {
	searchParams: Promise<{ conversation?: string }>;
}

export default async function AppRecruitingConversationsPage({
	searchParams,
}: AppRecruitingConversationsPageProps) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { conversation } = await searchParams;
	const conversations = await getRecruitmentChatConversations();

	return (
		<PageContainer>
			<PageHeader
				title="Recruiting Conversations"
				description="Follow up on every conversation that started from a recruiting listing or application."
			/>
			<ChatWorkspace
				contextKey="recruiting"
				currentUserId={user.id}
				conversations={conversations}
				initialConversationId={conversation ?? null}
				emptyTitle="No recruiting conversations yet"
				emptyDescription="Publish a listing or send an application to start a recruiting conversation."
			/>
		</PageContainer>
	);
}
