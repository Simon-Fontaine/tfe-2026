import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { RecruitmentConversationWorkspace } from "@/components/recruit/recruitment-conversation-workspace";
import { PageContainer } from "@/components/workspace/page-container";
import { getMyRecruitmentConversationSummaries } from "@/lib/data/chat";
import { appRoutes } from "@/lib/routes";
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
				title="Conversations"
				breadcrumbs={
					<Link href={appRoutes.recruiting.root} className="hover:underline">
						Recruiting
					</Link>
				}
			/>
			<RecruitmentConversationWorkspace
				currentUserId={user.id}
				conversations={conversations}
				initialConversationId={conversation ?? null}
			/>
		</PageContainer>
	);
}
