"use client";

import { Mail01Icon } from "@hugeicons/core-free-icons";
import type { RecruitmentThread } from "@scrimflow/shared";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { sendRecruitmentMessageAction } from "@/app/dashboard/recruit/actions/recruit";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { formatRecruitmentOwner } from "@/lib/recruitment";
import { publicRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface RecruitmentThreadPanelProps {
	thread: RecruitmentThread | null;
	currentUserId: string;
}

export function RecruitmentThreadPanel({ thread, currentUserId }: RecruitmentThreadPanelProps) {
	const [content, setContent] = useState("");
	const pendingRef = useRef(false);
	const { state, submit, isPending } = useFormAction(sendRecruitmentMessageAction, {
		loadingMessage: "Sending message\u2026",
		successMessage: "Message sent",
	});

	useEffect(() => {
		if (state?.success && pendingRef.current) {
			pendingRef.current = false;
			setContent("");
		}
	}, [state]);

	if (!thread) {
		return (
			<EmptyStateBlock
				icon={Mail01Icon}
				title="No conversation selected"
				description="Select a conversation to review the thread and send messages."
				variant="card"
			/>
		);
	}

	const activeThread = thread;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		pendingRef.current = true;
		const fd = new FormData();
		fd.set("threadId", activeThread.id);
		if (activeThread.post.teamId) fd.set("teamId", activeThread.post.teamId);
		if (activeThread.post.organizationId)
			fd.set("organizationId", activeThread.post.organizationId);
		fd.set("content", content);
		submit(fd);
	}

	return (
		<div className="flex min-h-[320px] flex-col border">
			<div className="border-b px-4 py-3">
				<p className="text-sm font-semibold">{activeThread.post.title}</p>
				<p className="mt-1 text-xs text-muted-foreground">
					{formatRecruitmentOwner(activeThread.post)} &middot;{" "}
					<Link
						href={publicRoutes.players.byUsername(activeThread.response.senderUsername)}
						className="hover:underline"
					>
						{activeThread.response.senderDisplayName}
					</Link>
				</p>
			</div>

			<div className="flex-1 space-y-3 overflow-y-auto p-4">
				{activeThread.messages.map((message) => {
					const isOwn = message.senderId === currentUserId;
					return (
						<div key={message.id} className={cn("flex gap-3", isOwn && "justify-end")}>
							{!isOwn && (
								<Avatar className="size-8 shrink-0 overflow-hidden rounded-none after:rounded-none">
									<AvatarImage
										src={message.senderAvatarUrl ?? undefined}
										className="rounded-none"
									/>
									<AvatarFallback className="rounded-none text-[10px] font-bold">
										{message.senderDisplayName.slice(0, 2).toUpperCase()}
									</AvatarFallback>
								</Avatar>
							)}
							<div
								className={cn("max-w-[80%] space-y-1 border px-3 py-2", isOwn && "bg-primary/5")}
							>
								<p className="text-[11px] font-medium">
									{message.isSystemMessage ? "System" : message.senderDisplayName}
								</p>
								<p className="whitespace-pre-wrap text-sm">{message.content}</p>
								<p className="text-[10px] text-muted-foreground">
									{new Date(message.createdAt).toLocaleString()}
								</p>
							</div>
						</div>
					);
				})}
			</div>

			{activeThread.isArchived ? (
				<div className="border-t p-4">
					<p className="text-center text-xs text-muted-foreground">
						This conversation has been closed and is read-only.
					</p>
				</div>
			) : (
				<form onSubmit={handleSubmit} className="space-y-3 border-t p-4">
					<Textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						rows={4}
						maxLength={1000}
						placeholder="Write your next message\u2026"
					/>
					<div className="flex justify-end">
						<Button type="submit" size="sm" disabled={isPending || content.trim().length === 0}>
							{isPending && <Spinner className="mr-1.5" />}
							Send message
						</Button>
					</div>
				</form>
			)}
		</div>
	);
}
