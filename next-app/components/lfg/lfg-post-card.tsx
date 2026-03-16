"use client";

import { GameController01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { applyToLfgPostAction } from "@/app/dashboard/scrims/actions/lfg";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import type { LfgPostSummary } from "@/lib/data/lfg";

const RANK_LABELS: Record<string, string> = {
	bronze: "Bronze",
	silver: "Silver",
	gold: "Gold",
	platinum: "Platinum",
	diamond: "Diamond",
	master: "Master",
	grandmaster: "Grandmaster",
	champion: "Champion",
};

const ROLE_LABELS: Record<string, string> = {
	tank: "Tank",
	damage: "DPS",
	support: "Support",
};

interface LfgPostCardProps {
	post: LfgPostSummary;
	currentUserId: string;
}

export function LfgPostCard({ post, currentUserId }: LfgPostCardProps) {
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState("");
	const pendingRef = useRef(false);
	const isOwnPost = post.userId === currentUserId;

	const { state, submit, isPending } = useFormAction(applyToLfgPostAction, {
		loadingMessage: "Submitting application…",
		successMessage: "Application submitted",
	});

	useEffect(() => {
		if (state?.success && pendingRef.current) {
			pendingRef.current = false;
			setOpen(false);
			setMessage("");
		}
	}, [state]);

	function handleApply(e: React.FormEvent) {
		e.preventDefault();
		pendingRef.current = true;
		const fd = new FormData();
		fd.set("postId", post.id);
		if (message.trim()) fd.set("message", message.trim());
		submit(fd);
	}

	const avatarUrl = post.teamAvatarUrl ?? post.userAvatarUrl;
	const displayName = post.teamName ? `[${post.teamTag}] ${post.teamName}` : post.userDisplayName;
	const fallback = post.teamTag ?? post.userDisplayName.slice(0, 2).toUpperCase();

	return (
		<div className="space-y-3 border p-4">
			<div className="flex items-start gap-3">
				<Avatar className="size-10 shrink-0 overflow-hidden rounded-none after:rounded-none">
					<AvatarImage src={avatarUrl ?? undefined} className="rounded-none" />
					<AvatarFallback className="rounded-none font-mono text-xs font-bold">
						{fallback}
					</AvatarFallback>
				</Avatar>

				<div className="min-w-0 flex-1">
					<div className="flex items-baseline gap-2">
						<p className="truncate text-sm font-semibold">{displayName}</p>
						{post.teamSr !== null && (
							<span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
								<HugeiconsIcon icon={GameController01Icon} strokeWidth={2} className="size-3" />
								SR {post.teamSr}
							</span>
						)}
					</div>
					{post.description && (
						<p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{post.description}</p>
					)}
				</div>

				{!isOwnPost && (
					<Dialog
						open={open}
						onOpenChange={(o) => {
							setOpen(o);
							if (!o) setMessage("");
						}}
					>
						<DialogTrigger asChild>
							<Button size="sm" variant="outline" className="shrink-0">
								Apply
							</Button>
						</DialogTrigger>
						<DialogContent className="sm:max-w-md">
							<DialogHeader>
								<DialogTitle>Apply to {post.teamName ?? "this post"}</DialogTitle>
							</DialogHeader>
							<form onSubmit={handleApply} className="space-y-4">
								<Field>
									<FieldLabel>
										Message <span className="font-normal text-muted-foreground/70">(optional)</span>
									</FieldLabel>
									<Textarea
										placeholder="Tell them why you'd be a great fit…"
										value={message}
										onChange={(e) => setMessage(e.target.value)}
										maxLength={500}
										rows={4}
									/>
								</Field>
								<div className="flex gap-2">
									<Button type="submit" size="sm" disabled={isPending}>
										{isPending && <Spinner className="mr-1.5" />}
										Submit application
									</Button>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => setOpen(false)}
										disabled={isPending}
									>
										Cancel
									</Button>
								</div>
							</form>
						</DialogContent>
					</Dialog>
				)}
			</div>

			<div className="flex flex-wrap gap-1.5">
				{post.rolesNeeded.map((role) => (
					<Badge key={role} variant="outline" className="text-[10px]">
						{ROLE_LABELS[role] ?? role}
					</Badge>
				))}
				{(post.minRank || post.maxRank) && (
					<Badge variant="outline" className="text-[10px]">
						{post.minRank && RANK_LABELS[post.minRank]}
						{post.minRank && post.maxRank && " – "}
						{post.maxRank && RANK_LABELS[post.maxRank]}
					</Badge>
				)}
				{post.region && (
					<Badge variant="secondary" className="text-[10px]">
						{post.region}
					</Badge>
				)}
			</div>
		</div>
	);
}
