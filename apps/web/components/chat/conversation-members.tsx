"use client";

import type { ChatParticipantSummary, UserPresenceStatus } from "@scrimflow/shared";
import { publicRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat";
import { PresenceDot } from "./presence-dot";

type MemberWithStatus = ChatParticipantSummary & { liveStatus: UserPresenceStatus };

function byDisplayName(a: MemberWithStatus, b: MemberWithStatus) {
	return a.displayName.localeCompare(b.displayName);
}

export function ConversationMembers({ participants }: { participants: ChatParticipantSummary[] }) {
	const presence = useChatStore((s) => s.presence);

	const { online, offline } = useMemo(() => {
		const withStatus: MemberWithStatus[] = participants.map((participant) => ({
			...participant,
			liveStatus: presence[participant.userId]?.status ?? participant.status,
		}));
		return {
			online: withStatus.filter((member) => member.liveStatus !== "offline").sort(byDisplayName),
			offline: withStatus.filter((member) => member.liveStatus === "offline").sort(byDisplayName),
		};
	}, [participants, presence]);

	return (
		<div className="flex h-full min-h-0 flex-col overflow-y-auto border">
			<p className="border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
				Members — {participants.length}
			</p>
			<MemberGroup label={`Online — ${online.length}`} members={online} />
			<MemberGroup label={`Offline — ${offline.length}`} members={offline} />
		</div>
	);
}

function MemberGroup({ label, members }: { label: string; members: MemberWithStatus[] }) {
	if (members.length === 0) return null;
	return (
		<div className="py-1">
			<p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
				{label}
			</p>
			{members.map((member) => (
				<MemberRow key={member.userId} member={member} />
			))}
		</div>
	);
}

function MemberRow({ member }: { member: MemberWithStatus }) {
	const isOffline = member.liveStatus === "offline";
	return (
		<Link
			href={publicRoutes.players.byUsername(member.username)}
			className={cn(
				"flex items-center gap-2 px-3 py-1.5 transition-colors hover:bg-muted",
				isOffline && "opacity-60"
			)}
		>
			<Avatar className="size-7 shrink-0 overflow-hidden rounded-none after:rounded-none">
				<AvatarImage src={member.avatarUrl ?? undefined} className="rounded-none" />
				<AvatarFallback className="rounded-none text-[10px] font-bold">
					{member.displayName.slice(0, 2).toUpperCase()}
				</AvatarFallback>
				<PresenceDot status={member.liveStatus} />
			</Avatar>
			<div className="min-w-0">
				<p className="truncate text-xs font-medium">{member.displayName}</p>
				{member.role !== "member" ? (
					<p className="truncate text-[10px] text-muted-foreground capitalize">{member.role}</p>
				) : null}
			</div>
		</Link>
	);
}
