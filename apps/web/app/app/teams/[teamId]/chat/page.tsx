import { MessageNotification02Icon } from "@hugeicons/core-free-icons";
import { appRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { getTeamChatRouteState } from "@/lib/data/chat";
import { getTeamWithRosterRouteState } from "@/lib/data/teams";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function TeamChatPage({
	params,
	searchParams,
}: {
	params: Promise<{ teamId: string }>;
	searchParams: Promise<{ conversation?: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const [{ teamId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
	const teamState = await getTeamWithRosterRouteState(teamId, user.id);
	if (teamState.kind === "missing") notFound();
	if (teamState.kind !== "success") {
		return <AccessGate title="Chat" resourceType="team" />;
	}
	if (!teamState.data.currentUser.canViewChat) {
		return <AccessGate title="Chat" resourceType="team" />;
	}

	const conversationsState = await getTeamChatRouteState(teamId);
	if (conversationsState.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader
					title="Chat"
					breadcrumbs={
						<>
							<Link href="/app" className="hover:underline">
								Teams
							</Link>
							{" / "}
							<Link href={appRoutes.teams.byId(teamState.data.id)} className="hover:underline">
								{teamState.data.name}
							</Link>
							{" / Chat"}
						</>
					}
				/>
				<EmptyState
					icon={MessageNotification02Icon}
					title={conversationsState.kind === "no-access" ? "No access." : "Chat unavailable."}
				/>
			</PageContainer>
		);
	}
	const team = teamState.data;
	const availableConversations = conversationsState.data;

	const initialConversationId =
		typeof resolvedSearchParams.conversation === "string"
			? resolvedSearchParams.conversation
			: null;

	return (
		<PageContainer>
			<PageHeader
				title="Chat"
				breadcrumbs={
					<>
						<Link href="/app" className="hover:underline">
							Teams
						</Link>
						{" / "}
						<Link href={appRoutes.teams.byId(team.id)} className="hover:underline">
							{team.name}
						</Link>
						{" / Chat"}
					</>
				}
			/>

			<ChatWorkspace
				contextKey={`team:${team.id}`}
				currentUserId={user.id}
				conversations={availableConversations}
				initialConversationId={initialConversationId}
				emptyTitle="No team chat channels yet"
				emptyDescription="Team-wide chat, scrim negotiations, and live lobby threads will appear here as soon as they are created."
			/>
		</PageContainer>
	);
}
