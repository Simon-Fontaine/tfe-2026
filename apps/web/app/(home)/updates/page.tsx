import { Notification01Icon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PublicListLoading } from "@/components/home/public-page-loading";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";
import { UpdatePostCard } from "@/components/updates/update-post-card";
import { getCurrentSession } from "@/lib/auth/session";
import { getPublicUpdates } from "@/lib/data/updates";

export const metadata: Metadata = {
	title: "Updates",
	description: "Team and organization announcements published through Scrimflow.",
};

export default async function UpdatesPage() {
	const { user } = await getCurrentSession();

	return (
		<PublicPageShell
			title="Updates"
			description="Team and organization announcements now have a dedicated feed separate from recruiting."
			maxWidth="5xl"
			contentClassName="space-y-6"
			actions={
				<Button asChild size="sm">
					<Link href={user ? "/app" : "/auth?step=login"}>
						{user ? "Open app workspace" : "Sign in to publish updates"}
					</Link>
				</Button>
			}
		>
			<Suspense fallback={<PublicListLoading />}>
				<UpdatesListSection />
			</Suspense>
		</PublicPageShell>
	);
}

async function UpdatesListSection() {
	let updates: Awaited<ReturnType<typeof getPublicUpdates>> = [];
	let hasError = false;
	try {
		updates = await getPublicUpdates();
	} catch {
		hasError = true;
	}

	if (hasError) {
		return (
			<EmptyStateBlock
				icon={Notification01Icon}
				title="Could not load content"
				description="Something went wrong loading this page. Please refresh to try again."
				variant="page"
			/>
		);
	}

	if (updates.length === 0) {
		return (
			<EmptyStateBlock
				icon={Notification01Icon}
				title="No updates yet"
				description="Check back later as teams and organizations share news."
				variant="page"
			/>
		);
	}

	return (
		<div className="space-y-3">
			{updates.map((post) => (
				<UpdatePostCard key={post.id} post={post} showScopeLink />
			))}
		</div>
	);
}
