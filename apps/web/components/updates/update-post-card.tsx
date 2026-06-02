import { Calendar03Icon, LinkSquare02Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { UpdatePostSummary } from "@scrimflow/shared";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { publicRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

function formatTimestamp(value: string) {
	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function getScopeHref(post: UpdatePostSummary) {
	if (post.teamId) return publicRoutes.teams.byId(post.teamId);
	if (post.organizationSlug) return publicRoutes.orgs.bySlug(post.organizationSlug);
	return null;
}

interface UpdatePostCardProps {
	post: UpdatePostSummary;
	actions?: React.ReactNode;
	showScopeLink?: boolean;
	showVisibilityBadge?: boolean;
	detailHref?: string;
	className?: string;
}

export function UpdatePostCard({
	post,
	actions,
	showScopeLink = false,
	showVisibilityBadge = true,
	detailHref,
	className,
}: UpdatePostCardProps) {
	const scopeHref = showScopeLink ? getScopeHref(post) : null;

	return (
		<article className={cn("border p-4", className)}>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="text-sm font-semibold">{post.title}</h2>
						{showVisibilityBadge ? (
							<Badge variant="outline">
								{post.visibility === "public" ? "Public" : "Workspace only"}
							</Badge>
						) : null}
					</div>
					<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
						<div className="flex items-center gap-1.5">
							<HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
							<span>{formatTimestamp(post.createdAt)}</span>
						</div>
						<div className="flex items-center gap-1.5">
							<HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-3.5" />
							<span>{post.authorDisplayName ?? "Unknown author"}</span>
						</div>
						{post.teamName ? (
							<div className="flex items-center gap-1.5">
								<HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-3.5" />
								<span>
									[{post.teamTag}] {post.teamName}
								</span>
							</div>
						) : post.organizationName ? (
							<div className="flex items-center gap-1.5">
								<HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-3.5" />
								<span>{post.organizationName}</span>
							</div>
						) : null}
					</div>
				</div>

				<div className="flex shrink-0 flex-wrap items-center gap-2">
					{detailHref ? (
						<Button asChild size="sm" variant="outline">
							<Link href={detailHref}>View update</Link>
						</Button>
					) : null}
					{scopeHref ? (
						<Button asChild size="sm" variant="outline">
							<Link href={scopeHref}>Open source</Link>
						</Button>
					) : null}
					{actions}
				</div>
			</div>

			<div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
				{post.body}
			</div>
		</article>
	);
}
