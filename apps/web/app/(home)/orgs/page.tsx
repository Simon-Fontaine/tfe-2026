import { GameController01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Organizations",
	description: "Discover Overwatch 2 esports organizations on Scrimflow.",
};

import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Suspense } from "react";
import { PublicGridLoading } from "@/components/home/public-page-loading";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPublicOrgs } from "@/lib/data/organization";
import { publicRoutes } from "@/lib/routes";

export default async function OrgsDirectoryPage() {
	return (
		<PublicPageShell
			title="Organizations"
			description="Discover organizations and the teams they operate."
			maxWidth="6xl"
			contentClassName="space-y-6"
		>
			<Suspense fallback={<PublicGridLoading />}>
				<OrgListSection />
			</Suspense>
		</PublicPageShell>
	);
}

async function OrgListSection() {
	let orgs: Awaited<ReturnType<typeof getPublicOrgs>> = [];
	let hasError = false;
	try {
		orgs = await getPublicOrgs();
	} catch {
		hasError = true;
	}

	if (hasError) {
		return (
			<EmptyStateBlock
				icon={UserGroupIcon}
				title="Could not load content"
				description="Something went wrong loading this page. Please refresh to try again."
				variant="page"
			/>
		);
	}

	if (orgs.length === 0) {
		return (
			<EmptyStateBlock
				icon={UserGroupIcon}
				title="No public organizations yet"
				description="Check back later as organizations publish their workspace profiles."
				variant="page"
			/>
		);
	}

	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{orgs.map((org) => (
				<Link
					key={org.id}
					href={publicRoutes.orgs.bySlug(org.slug)}
					className="flex items-center gap-3 border p-4 transition-colors hover:bg-muted/50"
				>
					<Avatar className="size-10 shrink-0 overflow-hidden rounded-none after:rounded-none">
						<AvatarImage src={org.avatarUrl ?? undefined} className="rounded-none" />
						<AvatarFallback className="rounded-none text-xs font-bold">
							{org.name.substring(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-semibold">{org.name}</p>
						<div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
							<span className="flex items-center gap-1">
								<HugeiconsIcon icon={GameController01Icon} strokeWidth={2} className="size-3" />
								{org.teamCount} team{org.teamCount === 1 ? "" : "s"}
							</span>
							<span className="flex items-center gap-1">
								<HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-3" />
								{org.activeRosterCount} active
							</span>
						</div>
					</div>
				</Link>
			))}
		</div>
	);
}
