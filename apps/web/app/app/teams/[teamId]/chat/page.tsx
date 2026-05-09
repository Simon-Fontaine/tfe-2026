import { MessageNotification02Icon, Time04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccessGate } from "@/components/workspace/access-gate";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { getTeamChatRouteState } from "@/lib/data/chat";
import { getTeamWithRosterRouteState } from "@/lib/data/teams";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

function formatConversationTypeLabel(type: string) {
	switch (type) {
		case "team":
			return "Team room";
		case "scrim_lobby":
			return "Scrim lobby";
		case "scrim_negotiation":
			return "Scrim negotiation";
		default:
			return type;
	}
}

export default async function TeamChatPage({
	params,
	searchParams,
}: {
	params: Promise<{ teamId: string }>;
	searchParams: Promise<{ conversation?: string }>;
}) {
	const { user } = await requireWorkspaceSession();

	const [{ teamId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
	const [teamState, conversationsState] = await Promise.all([
		getTeamWithRosterRouteState(teamId, user.id),
		getTeamChatRouteState(teamId),
	]);
	if (teamState.kind === "missing") notFound();
	if (teamState.kind !== "success") {
		return <AccessGate title="Chat" resourceType="team" />;
	}
	if (conversationsState.kind !== "success") {
		return (
			<PageContainer>
				<PageHeader
					title="Chat"
					detail={`[${teamState.data.tag}] ${teamState.data.name}`}
					description={`Persistent team room plus scrim negotiation and lobby channels for ${teamState.data.name}.`}
					actions={
						<Button asChild size="sm" variant="outline">
							<Link href={appRoutes.teams.byId(teamState.data.id)}>Back to team overview</Link>
						</Button>
					}
				/>
				<EmptyStateBlock
					icon={MessageNotification02Icon}
					title={conversationsState.kind === "no-access" ? "No access" : "Chat unavailable"}
					description={
						conversationsState.kind === "no-access"
							? "This team chat workspace is only available to active roster members."
							: "This team chat route does not match an available channel context."
					}
					variant="card"
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
	const teamRoom =
		availableConversations.find((conversation) => conversation.type === "team") ?? null;
	const scrimRooms = availableConversations.filter((conversation) => conversation.scrimId);

	return (
		<PageContainer>
			<PageHeader
				title="Chat"
				detail={`[${team.tag}] ${team.name}`}
				description={`Persistent team room plus scrim negotiation and lobby channels for ${team.name}.`}
				actions={
					<Button asChild size="sm" variant="outline">
						<Link href={appRoutes.teams.byId(team.id)}>Back to team overview</Link>
					</Button>
				}
			/>

			<div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
				<section className="border p-4">
					<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Channel overview
					</p>
					<div className="mt-4 flex flex-wrap gap-2">
						<Badge variant="outline">{availableConversations.length} channel(s)</Badge>
						<Badge variant="outline">{scrimRooms.length} scrim-linked</Badge>
						<Badge variant="outline">
							{availableConversations.reduce(
								(total, conversation) => total + conversation.unreadCount,
								0
							)}{" "}
							unread
						</Badge>
					</div>
					{teamRoom ? (
						<p className="mt-3 text-xs text-muted-foreground">
							Your roster's persistent room is live as{" "}
							<span className="font-medium text-foreground">{teamRoom.name}</span>.
						</p>
					) : (
						<p className="mt-3 text-xs text-muted-foreground">
							The team room will be created automatically the first time this workspace loads.
						</p>
					)}
				</section>

				<section className="border p-4">
					<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Recent channels
					</p>
					{availableConversations.length === 0 ? (
						<div className="mt-4">
							<EmptyStateBlock
								icon={MessageNotification02Icon}
								title="No channels yet"
								description="Team chat will appear here once a roster room or scrim thread exists."
								variant="inline"
							/>
						</div>
					) : (
						<div className="mt-4 space-y-2">
							{availableConversations.slice(0, 3).map((conversation) => (
								<div key={conversation.id} className="border p-3">
									<div className="flex items-center justify-between gap-2">
										<p className="line-clamp-1 text-sm font-semibold">{conversation.name}</p>
										<Badge variant="outline">
											{formatConversationTypeLabel(conversation.type)}
										</Badge>
									</div>
									<div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
										<HugeiconsIcon icon={Time04Icon} strokeWidth={2} className="size-3.5" />
										<span>
											{conversation.lastMessageAt
												? new Intl.DateTimeFormat("en-GB", {
														dateStyle: "medium",
														timeStyle: "short",
													}).format(new Date(conversation.lastMessageAt))
												: "No messages yet"}
										</span>
									</div>
								</div>
							))}
						</div>
					)}
				</section>
			</div>

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
