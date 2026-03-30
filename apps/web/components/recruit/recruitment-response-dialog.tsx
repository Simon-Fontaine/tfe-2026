"use client";

import type { RecruitmentPostSummary } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { respondToRecruitmentPostAction } from "@/app/dashboard/recruit/actions/recruit";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import type { RecruitEntityOption } from "@/lib/recruitment";
import { getPostResponseLabel } from "@/lib/recruitment";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface RecruitmentResponseDialogProps {
	post: RecruitmentPostSummary;
	entityOptions?: RecruitEntityOption[];
	conversationHrefBase?: string;
	children?: React.ReactNode;
}

export function RecruitmentResponseDialog({
	post,
	entityOptions = [],
	conversationHrefBase,
	children,
}: RecruitmentResponseDialogProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState("");
	const [senderChoice, setSenderChoice] = useState(`player:self`);
	const pendingRef = useRef(false);
	const { state, submit, isPending } = useFormAction(respondToRecruitmentPostAction, {
		loadingMessage: "Sending response…",
		successMessage: "Response sent",
	});

	useEffect(() => {
		if (state?.success && pendingRef.current) {
			pendingRef.current = false;
			setOpen(false);
			setMessage("");
			if ("conversationId" in state && state.conversationId) {
				router.push(
					`${conversationHrefBase ?? dashboardRoutes.discover.conversations}?conversation=${state.conversationId}`
				);
			}
		}
	}, [conversationHrefBase, router, state]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		pendingRef.current = true;
		const fd = new FormData();
		fd.set("postId", post.id);
		if (post.teamId) fd.set("teamId", post.teamId);
		if (post.organizationId) fd.set("organizationId", post.organizationId);
		if (message.trim()) fd.set("message", message.trim());
		if (post.ownerType === "player") {
			const [senderType, senderId] = senderChoice.split(":");
			if (senderType === "team") fd.set("senderTeamId", senderId);
			if (senderType === "organization") fd.set("senderOrganizationId", senderId);
		}
		submit(fd);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				if (!nextOpen) setMessage("");
			}}
		>
			<DialogTrigger asChild>
				{children ?? (
					<Button size="sm" variant="outline">
						{getPostResponseLabel(post)}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{getPostResponseLabel(post)} to {post.title}
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					{post.ownerType === "player" && entityOptions.length > 0 && (
						<Field>
							<FieldLabel>Send as</FieldLabel>
							<div className="grid gap-2">
								<button
									type="button"
									data-selected={senderChoice === "player:self"}
									onClick={() => setSenderChoice("player:self")}
									className={cn(
										"border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted",
										"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
									)}
								>
									My account
								</button>
								{entityOptions.map((entity) => (
									<button
										key={`${entity.type}:${entity.id}`}
										type="button"
										data-selected={senderChoice === `${entity.type}:${entity.id}`}
										onClick={() => setSenderChoice(`${entity.type}:${entity.id}`)}
										className={cn(
											"border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted",
											"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
										)}
									>
										{entity.label}
									</button>
								))}
							</div>
						</Field>
					)}

					<Field>
						<FieldLabel>Message</FieldLabel>
						<Textarea
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							rows={5}
							maxLength={500}
							placeholder="Introduce yourself, share availability, and explain why you're a fit."
						/>
					</Field>

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={isPending}>
							{isPending && <Spinner className="mr-1.5" />}
							Send response
						</Button>
						<Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
							Cancel
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
