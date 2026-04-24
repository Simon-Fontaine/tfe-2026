import { Notification01Icon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PublicListLoading } from "@/components/home/public-page-loading";
import { PublicPageSection } from "@/components/home/public-page-section";
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
			<div className="flex flex-wrap gap-2">
				{UPDATE_FILTERS.map((filter) => (
					<Link key={filter} href={filter === "all" ? "/updates" : `/updates?scope=${filter}`}>
						<Button size="sm" variant={scope === filter ? "default" : "outline"}>
							{filter === "all" ? "All updates" : `${filter} updates`}
						</Button>
					</Link>
				))}
			</div>
			<Suspense fallback={<PublicListLoading />}>
				<UpdatesListSection scope={scope} />
			</Suspense>
			<PublicPageSection
				title="Related public routes"
				description="Use adjacent routes to move from announcements into the rest of the public funnel."
			>
				<div className="grid gap-3 md:grid-cols-3">
					<Link href="/orgs" className="border p-4 transition-colors hover:bg-muted/50">
						<p className="text-sm font-semibold">Organizations</p>
						<p className="mt-2 text-sm text-muted-foreground">
							Jump into the org surfaces behind multi-team announcements and staff operations.
						</p>
					</Link>
					<Link href="/teams" className="border p-4 transition-colors hover:bg-muted/50">
						<p className="text-sm font-semibold">Teams</p>
						<p className="mt-2 text-sm text-muted-foreground">
							Open team profiles when an update makes you want roster, recruiting, or activity
							context.
						</p>
					</Link>
					<Link href="/scrims" className="border p-4 transition-colors hover:bg-muted/50">
						<p className="text-sm font-semibold">Scrims</p>
						<p className="mt-2 text-sm text-muted-foreground">
							Pair public announcements with recent match activity for a clearer read on momentum.
						</p>
					</Link>
				</div>
			</PublicPageSection>
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
		<div className="space-y-3">
			{filteredUpdates.map((post) => (
				<UpdatePostCard key={post.id} post={post} showScopeLink />
			))}
		</div>
	);
}
