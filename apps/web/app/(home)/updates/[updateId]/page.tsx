import { Notification01Icon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { PublicRelatedRouteCards } from "@/components/home/public-related-route-cards";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";
import { UpdatePostCard } from "@/components/updates/update-post-card";
import { getPublicUpdateById } from "@/lib/data/updates";
import { publicRoutes } from "@/lib/routes";

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
			<PublicPageShell title="Update" description="Public update post." maxWidth="3xl">
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
		<PublicPageShell
			title="Update"
			description="Public update post."
			maxWidth="3xl"
			contentClassName="space-y-6"
		>
			<UpdatePostCard post={post} />

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

			<PublicPageSection
				title="Related public routes"
				description="Keep exploring public activity and competitive context."
			>
				<PublicRelatedRouteCards
					cards={[
						{
							label: "Updates",
							href: publicRoutes.updates.root,
							description: "Browse all public announcements from teams and organizations.",
						},
						{
							label: "Teams",
							href: publicRoutes.teams.root,
							description: "Explore public team profiles and their competitive activity.",
						},
						{
							label: "Scrims",
							href: publicRoutes.scrims.root,
							description: "See completed scrim results and the broader competitive landscape.",
						},
					]}
				/>
			</PublicPageSection>
		</PublicPageShell>
	);
}
