"use client";

import { SentIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { chatSocket } from "@/lib/ws/chat-socket";

interface MessageInputProps {
	conversationId: string;
	disabled?: boolean;
	onSend: (content: string) => Promise<void>;
}

const TYPING_DEBOUNCE_MS = 1_200;

export function MessageInput({ conversationId, disabled, onSend }: MessageInputProps) {
	const [message, setMessage] = useState("");
	const [isSending, setIsSending] = useState(false);
	const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isTypingRef = useRef(false);

	// Clean up typing timer on unmount
	useEffect(() => {
		return () => {
			if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
			if (isTypingRef.current) {
				chatSocket.sendTypingStop(conversationId);
				isTypingRef.current = false;
			}
		};
	}, [conversationId]);

	function handleChange(value: string) {
		setMessage(value);

		if (value.trim().length > 0) {
			if (!isTypingRef.current) {
				chatSocket.sendTypingStart(conversationId);
				isTypingRef.current = true;
			}
			if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
			typingTimerRef.current = setTimeout(() => {
				chatSocket.sendTypingStop(conversationId);
				isTypingRef.current = false;
			}, TYPING_DEBOUNCE_MS);
		} else {
			if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
			if (isTypingRef.current) {
				chatSocket.sendTypingStop(conversationId);
				isTypingRef.current = false;
			}
		}
	}

	async function handleSend() {
		const content = message.trim();
		if (!content || isSending) return;

		// Stop typing indicator immediately
		if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
		if (isTypingRef.current) {
			chatSocket.sendTypingStop(conversationId);
			isTypingRef.current = false;
		}

		setMessage("");
		setIsSending(true);
		try {
			await onSend(content);
		} finally {
			setIsSending(false);
		}
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			void handleSend();
		}
	}

	return (
		<div className="space-y-2 border-t p-4">
			<Textarea
				value={message}
				onChange={(e) => handleChange(e.target.value)}
				onKeyDown={handleKeyDown}
				rows={3}
				maxLength={2000}
				placeholder="Write a message… (Enter to send, Shift+Enter for new line)"
				disabled={disabled || isSending}
				className="resize-none"
			/>
			<div className="flex items-center justify-between">
				<p className="text-[11px] text-muted-foreground">{message.length}/2000</p>
				<Button
					type="button"
					size="sm"
					onClick={handleSend}
					disabled={isSending || message.trim().length === 0 || disabled}
				>
					{isSending ? (
						<Spinner className="mr-1.5" />
					) : (
						<HugeiconsIcon icon={SentIcon} strokeWidth={2} className="mr-1.5 size-3.5" />
					)}
					Send
				</Button>
			</div>
		</div>
	);
}
