import { Notification01Icon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PublicFilterBar } from "@/components/home/public-filter-bar";
import { PublicListLoading } from "@/components/home/public-page-loading";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Button } from "@/components/ui/button";
import { UpdatePostCard } from "@/components/updates/update-post-card";
import { getCurrentSession } from "@/lib/auth/session";
import { getPublicUpdates } from "@/lib/data/updates";
import { appRoutes, publicRoutes } from "@/lib/routes";

export const metadata: Metadata = {
	title: "Updates",
	description: "Team and organization announcements published through Scrimflow.",
};

const UPDATE_FILTERS = ["all", "team", "organization"] as const;

interface UpdatesPageProps {
	searchParams: Promise<{ scope?: string }>;
}

export default async function UpdatesPage({ searchParams }: UpdatesPageProps) {
	const { user } = await getCurrentSession();
	const { scope: scopeParam } = await searchParams;
	const scope = UPDATE_FILTERS.includes((scopeParam ?? "all") as (typeof UPDATE_FILTERS)[number])
		? ((scopeParam ?? "all") as (typeof UPDATE_FILTERS)[number])
		: "all";

	return (
		<PublicPageShell
			title="Updates"
			maxWidth="5xl"
			contentClassName="space-y-6"
			actions={
				<Button asChild size="sm">
					<Link href={user ? appRoutes.root : publicRoutes.auth.step("login")}>
						{user ? "Open app workspace" : "Sign in to publish updates"}
					</Link>
				</Button>
			}
		>
			<PublicFilterBar
				options={UPDATE_FILTERS.map((filter) => ({
					label: filter === "all" ? "All updates" : `${filter} updates`,
					href: publicRoutes.updates.withScope(filter),
					active: scope === filter,
				}))}
			/>
			<Suspense fallback={<PublicListLoading />}>
				<UpdatesListSection scope={scope} />
			</Suspense>
		</PublicPageShell>
	);
}

async function UpdatesListSection({ scope }: { scope: "all" | "team" | "organization" }) {
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

	const filteredUpdates =
		scope === "all" ? updates : updates.filter((post) => post.scopeType === scope);

	if (filteredUpdates.length === 0) {
		return (
			<EmptyStateBlock
				icon={Notification01Icon}
				title="No updates match this scope yet"
				description="Switch the scope or return to all updates to browse more public announcements."
				variant="page"
			/>
		);
	}

	return (
		<div className="divide-y border">
			{filteredUpdates.map((post) => (
				<UpdatePostCard
					key={post.id}
					post={post}
					showScopeLink
					showVisibilityBadge={false}
					detailHref={publicRoutes.updates.byId(post.id)}
					className="border-0 px-4 py-3"
				/>
			))}
		</div>
	);
}
