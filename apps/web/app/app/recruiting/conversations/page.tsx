import { RecruitmentConversationWorkspace } from "@/components/recruit/recruitment-conversation-workspace";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getMyRecruitmentConversationSummaries } from "@/lib/data/chat";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

interface AppRecruitingConversationsPageProps {
	searchParams: Promise<{ conversation?: string }>;
}

export default async function AppRecruitingConversationsPage({
	searchParams,
}: AppRecruitingConversationsPageProps) {
	const { user } = await requireWorkspaceSession();

	const { conversation } = await searchParams;
	const conversations = await getMyRecruitmentConversationSummaries();

	return (
		<PageContainer>
			<PageHeader
				title="Recruiting Conversations"
				description="Follow up on every conversation that started from a recruiting listing or application."
			/>
			<RecruitmentConversationWorkspace
				currentUserId={user.id}
				conversations={conversations}
				initialConversationId={conversation ?? null}
			/>
		</PageContainer>
	);
}
