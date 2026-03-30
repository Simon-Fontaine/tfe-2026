import { notFound } from "next/navigation";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getChatConversations } from "@/lib/data/chat";
import { getTeamWithRoster } from "@/lib/data/teams";

export default async function TeamConversationsPage({
	params,
	searchParams,
}: {
	params: Promise<{ teamId: string }>;
	searchParams: Promise<{ conversation?: string }>;
}) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { teamId } = await params;
	const team = await getTeamWithRoster(teamId, user.id);
	if (!team) notFound();

	const { conversation } = await searchParams;
	const allConversations = await getChatConversations();
	const conversations = allConversations.filter((item) => item.teamId === team.id);

	return (
		<PageContainer>
			<PageHeader title="Team chat" description={`Chat channels for ${team.name}.`} />
			<ChatWorkspace
				currentUserId={user.id}
				conversations={conversations}
				initialConversationId={conversation ?? null}
				emptyTitle="No team chat yet"
				emptyDescription="Team and recruiting conversations will appear here."
			/>
		</PageContainer>
	);
}
