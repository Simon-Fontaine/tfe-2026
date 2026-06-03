import { Notification01Icon } from "@hugeicons/core-free-icons";
import { publicRoutes } from "@scrimflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { PublicRelatedRouteCards } from "@/components/home/public-related-route-cards";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";
import { getPublicUpdateById } from "@/lib/data/updates";

function formatTimestamp(value: string) {
	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ updateId: string }>;
}): Promise<Metadata> {
	const { updateId } = await params;
	let post: Awaited<ReturnType<typeof getPublicUpdateById>> | null = null;
	try {
		post = await getPublicUpdateById(updateId);
	} catch {
		// metadata fetch must not throw
	}
	if (!post) return { title: "Update not available" };
	return {
		title: post.title,
		description: post.body.slice(0, 155),
	};
}

export default async function PublicUpdateDetailPage({
	params,
}: {
	params: Promise<{ updateId: string }>;
}) {
	const { updateId } = await params;

	let post: Awaited<ReturnType<typeof getPublicUpdateById>> = null;
	try {
		post = await getPublicUpdateById(updateId);
	} catch {
		return (
			<PublicPageShell title="Update" maxWidth="3xl">
				<EmptyStateBlock
					icon={Notification01Icon}
					title="Could not load this page"
					description="The update could not be loaded right now. Browse all updates or try again in a moment."
					actionHref={publicRoutes.updates.root}
					actionLabel="Browse updates"
					variant="page"
				/>
			</PublicPageShell>
		);
	}
	if (!post) notFound();

	const sourceHref = post.teamId
		? publicRoutes.teams.byId(post.teamId)
		: post.organizationSlug
			? publicRoutes.orgs.bySlug(post.organizationSlug)
			: null;

	return (
		<PublicPageShell title={post.title} maxWidth="3xl" contentClassName="space-y-6">
			<div className="space-y-4">
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
					<span>{formatTimestamp(post.createdAt)}</span>
					<span>{post.authorDisplayName ?? "Unknown author"}</span>
					{post.teamId && post.teamName ? (
						<Link href={publicRoutes.teams.byId(post.teamId)} className="hover:underline">
							[{post.teamTag}] {post.teamName}
						</Link>
					) : post.organizationSlug && post.organizationName ? (
						<Link
							href={publicRoutes.orgs.bySlug(post.organizationSlug)}
							className="hover:underline"
						>
							{post.organizationName}
						</Link>
					) : null}
				</div>
				<div className="whitespace-pre-wrap text-sm leading-relaxed">{post.body}</div>
			</div>

			<div className="flex flex-wrap gap-2">
				<Button asChild size="sm" variant="outline">
					<Link href={publicRoutes.updates.root}>Back to updates</Link>
				</Button>
				{sourceHref && (
					<Button asChild size="sm" variant="outline">
						<Link href={sourceHref}>Open source</Link>
					</Button>
				)}
			</div>

			<PublicPageSection title="Related public routes">
				<PublicRelatedRouteCards
					cards={[
						{
							label: "Updates",
							href: publicRoutes.updates.root,
						},
						{
							label: "Teams",
							href: publicRoutes.teams.root,
						},
						{
							label: "Scrims",
							href: publicRoutes.scrims.root,
						},
					]}
				/>
			</PublicPageSection>
		</PublicPageShell>
	);
}
