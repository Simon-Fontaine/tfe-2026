import { notFound } from "next/navigation";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getChatConversations } from "@/lib/data/chat";
import { getOrgWithTeams } from "@/lib/data/orgs";

interface OrgConversationsPageProps {
	params: Promise<{ orgId: string }>;
	searchParams: Promise<{ conversation?: string }>;
}

export default async function OrgConversationsPage({
	params,
	searchParams,
}: OrgConversationsPageProps) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId } = await params;
	const org = await getOrgWithTeams(orgId, user.id);
	if (!org) notFound();

	const { conversation } = await searchParams;
	const conversations = (await getChatConversations()).filter(
		(item) => !item.teamId || org.activeTeams.some((team) => team.id === item.teamId)
	);

	return (
		<PageContainer>
			<PageHeader title="Organisation chat" description={`Chat channels for ${org.name}.`} />
			<ChatWorkspace
				currentUserId={user.id}
				conversations={conversations}
				initialConversationId={conversation ?? null}
				emptyTitle="No organisation chat yet"
				emptyDescription="Organisation and team conversations will appear here."
			/>
		</PageContainer>
	);
}
