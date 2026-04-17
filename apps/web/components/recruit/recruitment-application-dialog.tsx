"use client";

import type { RecruitmentListingSummary } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createRecruitmentApplicationAction } from "@/app/actions/recruit";
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
import { getRecruitmentApplicationLabel } from "@/lib/recruitment";
import { appRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface RecruitmentApplicationDialogProps {
	listing: RecruitmentListingSummary;
	entityOptions?: RecruitEntityOption[];
	conversationHrefBase?: string;
	children?: React.ReactNode;
}

export function RecruitmentApplicationDialog({
	listing,
	entityOptions = [],
	conversationHrefBase,
	children,
}: RecruitmentApplicationDialogProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState("");
	const [senderChoice, setSenderChoice] = useState(`player:self`);
	const pendingRef = useRef(false);
	const { state, submit, isPending } = useFormAction(createRecruitmentApplicationAction, {
		loadingMessage: "Sending application…",
		successMessage: "Application sent",
	});

	useEffect(() => {
		if (state?.success && pendingRef.current) {
			pendingRef.current = false;
			setOpen(false);
			setMessage("");
			if ("conversationId" in state && state.conversationId) {
				router.push(
					`${conversationHrefBase ?? appRoutes.recruiting.conversations}?conversation=${state.conversationId}`
				);
			}
		}
	}, [conversationHrefBase, router, state]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		pendingRef.current = true;
		const fd = new FormData();
		fd.set("listingId", listing.id);
		if (listing.teamId) fd.set("teamId", listing.teamId);
		if (listing.organizationId) fd.set("organizationId", listing.organizationId);
		if (message.trim()) fd.set("message", message.trim());
		if (listing.ownerType === "player") {
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
						{getRecruitmentApplicationLabel(listing)}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{getRecruitmentApplicationLabel(listing)} to {listing.title}
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					{listing.ownerType === "player" && entityOptions.length > 0 && (
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
							Send application
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
