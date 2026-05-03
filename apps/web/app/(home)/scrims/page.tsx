import { Calendar03Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ScrimStatus } from "@scrimflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PublicListLoading } from "@/components/home/public-page-loading";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { PublicRelatedRouteCards } from "@/components/home/public-related-route-cards";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { getPublicScrims } from "@/lib/data/scrims";
import { appRoutes, publicRoutes } from "@/lib/routes";

const SCRIM_STATUS_LABELS = {
	pending: "Pending",
	accepted: "Accepted",
	scheduled: "Scheduled",
	in_progress: "In progress",
	awaiting_confirmation: "Awaiting confirmation",
	completed: "Completed",
	cancelled: "Cancelled",
	disputed: "Disputed",
} as const;

function formatScheduledAt(value: string | null) {
	if (!value) return "Scheduling in progress";
	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

export const metadata: Metadata = {
	title: "Scrims",
	description: "Browse recent and upcoming Overwatch 2 scrims on Scrimflow.",
};

const SCRIM_FILTERS = ["all", "scheduled", "completed", "disputed"] as const;

interface ScrimsDirectoryPageProps {
	searchParams: Promise<{ status?: string }>;
}

export default async function ScrimsDirectoryPage({ searchParams }: ScrimsDirectoryPageProps) {
	const { user } = await getCurrentSession();
	const { status: statusParam } = await searchParams;
	const status = SCRIM_FILTERS.includes((statusParam ?? "all") as (typeof SCRIM_FILTERS)[number])
		? ((statusParam ?? "all") as (typeof SCRIM_FILTERS)[number])
		: "all";

	return (
		<PublicPageShell
			title="Scrims"
			description="Recent and upcoming scrims surface scheduling, scorelines, and confirmation state in one place."
			maxWidth="6xl"
			contentClassName="space-y-6"
			actions={
				<Button asChild size="sm">
					<Link href={user ? appRoutes.root : publicRoutes.auth.step("login")}>
						{user ? "Open team workspace" : "Sign in to manage scrims"}
					</Link>
				</Button>
			}
		>
			<div className="flex flex-wrap gap-2">
				{SCRIM_FILTERS.map((filter) => (
					<Link key={filter} href={publicRoutes.scrims.withStatus(filter)}>
						<Badge variant={status === filter ? "default" : "outline"}>
							{filter === "all" ? "All scrims" : SCRIM_STATUS_LABELS[filter]}
						</Badge>
					</Link>
				))}
			</div>
			<Suspense fallback={<PublicListLoading />}>
				<ScrimsListSection status={status} />
			</Suspense>
			<PublicPageSection
				title="Related public routes"
				description="Keep the competitive context intact while moving through the public product."
			>
				<PublicRelatedRouteCards
					cards={[
						{
							label: "Teams",
							href: publicRoutes.teams.root,
							description:
								"Inspect the teams behind public scrims and see whether they are actively recruiting.",
						},
						{
							label: "Updates",
							href: publicRoutes.updates.root,
							description:
								"Read public team and org announcements alongside the competitive match feed.",
						},
						{
							label: "Recruiting",
							href: publicRoutes.recruiting.root,
							description:
								"Move from recent public competition into current roster and staffing opportunities.",
						},
					]}
				/>
			</PublicPageSection>
		</PublicPageShell>
	);
}

async function ScrimsListSection({
	status,
}: {
	status: "all" | Extract<ScrimStatus, "scheduled" | "completed" | "disputed">;
}) {
	let scrims: Awaited<ReturnType<typeof getPublicScrims>> = [];
	let hasError = false;
	try {
		scrims = await getPublicScrims();
	} catch {
		hasError = true;
	}

	if (hasError) {
		return (
			<EmptyStateBlock
				icon={Calendar03Icon}
				title="Could not load content"
				description="Something went wrong loading this page. Please refresh to try again."
				variant="page"
			/>
		);
	}

	if (scrims.length === 0) {
		return (
			<EmptyStateBlock
				icon={Calendar03Icon}
				title="No public scrims yet"
				description="Check back later as teams schedule their matches."
				variant="page"
			/>
		);
	}

	const filteredScrims =
		status === "all" ? scrims : scrims.filter((scrim) => scrim.status === status);

	if (filteredScrims.length === 0) {
		return (
			<EmptyStateBlock
				icon={Calendar03Icon}
				title="No scrims match this filter"
				description="Switch the filter or return to all public scrims to browse more activity."
				variant="page"
			/>
		);
	}

	return (
		<div className="space-y-3">
			{filteredScrims.map((scrim) => (
				<div key={scrim.id} className="border p-4">
					<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
						<div className="space-y-2">
							<div className="flex flex-wrap items-center gap-2">
								<p className="text-sm font-semibold">
									[{scrim.homeTeam.tag}] {scrim.homeTeam.name}
									{" vs "}
									{scrim.awayTeam ? `[${scrim.awayTeam.tag}] ${scrim.awayTeam.name}` : "TBD"}
								</p>
								<Badge variant={scrim.status === "disputed" ? "destructive" : "outline"}>
									{SCRIM_STATUS_LABELS[scrim.status]}
								</Badge>
							</div>
							<p className="text-xs text-muted-foreground">
								{scrim.message ?? "No manager note added yet."}
							</p>
						</div>

						<div className="grid gap-2 text-xs text-muted-foreground md:min-w-64">
							<div className="flex items-center gap-2">
								<HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
								<span>{formatScheduledAt(scrim.scheduledAt)}</span>
							</div>
							<div className="flex items-center gap-2">
								<HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-3.5" />
								<span>
									Series score {scrim.homeMapScore} - {scrim.awayMapScore}
								</span>
							</div>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
