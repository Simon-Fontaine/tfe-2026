"use client";

import { Delete01Icon, Edit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ChatMessage } from "@scrimflow/shared";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
	message: ChatMessage;
	currentUserId: string;
	onEdit?: (messageId: string, newContent: string) => Promise<void>;
	onDelete?: (messageId: string) => Promise<void>;
}

export function MessageBubble({ message, currentUserId, onEdit, onDelete }: MessageBubbleProps) {
	const isOwn = message.senderId === currentUserId;
	const isDeleted = Boolean(message.deletedAt);
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(message.content);
	const [isSaving, setIsSaving] = useState(false);

	async function handleSaveEdit() {
		if (!onEdit || editContent.trim() === message.content.trim()) {
			setIsEditing(false);
			return;
		}
		setIsSaving(true);
		try {
			await onEdit(message.id, editContent.trim());
			setIsEditing(false);
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<div className={cn("group flex gap-3", isOwn && "justify-end")}>
			{!isOwn ? (
				<Avatar className="size-8 shrink-0 overflow-hidden rounded-none after:rounded-none">
					<AvatarImage src={message.senderAvatarUrl ?? undefined} className="rounded-none" />
					<AvatarFallback className="rounded-none text-[10px] font-bold">
						{(message.senderDisplayName ?? "?").slice(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
			) : null}

			<div className={cn("max-w-[80%] space-y-1", isOwn && "items-end")}>
				<p className={cn("text-[11px] font-medium", isOwn && "text-right")}>
					{message.senderDisplayName}
				</p>

				<div className={cn("border px-3 py-2", isOwn && "bg-primary/5", isDeleted && "opacity-50")}>
					{isEditing ? (
						<div className="space-y-2">
							<Textarea
								value={editContent}
								onChange={(e) => setEditContent(e.target.value)}
								rows={3}
								maxLength={2000}
								autoFocus
								className="text-sm"
							/>
							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => {
										setEditContent(message.content);
										setIsEditing(false);
									}}
								>
									Cancel
								</Button>
								<Button
									type="button"
									size="sm"
									disabled={isSaving || editContent.trim().length === 0}
									onClick={handleSaveEdit}
								>
									Save
								</Button>
							</div>
						</div>
					) : (
						<p className="whitespace-pre-wrap text-sm">{message.content}</p>
					)}
				</div>

				<div className={cn("flex items-center gap-2", isOwn && "justify-end")}>
					<p className="text-[10px] text-muted-foreground">
						{new Date(message.createdAt).toLocaleTimeString([], {
							hour: "2-digit",
							minute: "2-digit",
						})}
					</p>
					{message.editedAt ? <p className="text-[10px] text-muted-foreground">(edited)</p> : null}

					{isOwn && !isDeleted && !isEditing && !message.isSystemMessage ? (
						<div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
							{onEdit ? (
								<button
									type="button"
									title="Edit message"
									className="text-muted-foreground hover:text-foreground"
									onClick={() => setIsEditing(true)}
								>
									<HugeiconsIcon icon={Edit01Icon} strokeWidth={2} className="size-3" />
								</button>
							) : null}
							{onDelete ? (
								<button
									type="button"
									title="Delete message"
									className="text-muted-foreground hover:text-destructive"
									onClick={() => onDelete(message.id)}
								>
									<HugeiconsIcon icon={Delete01Icon} strokeWidth={2} className="size-3" />
								</button>
							) : null}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
