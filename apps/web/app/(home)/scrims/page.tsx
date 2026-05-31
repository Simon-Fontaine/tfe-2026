import { Calendar03Icon } from "@hugeicons/core-free-icons";
import type { ScrimStatus } from "@scrimflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PublicListLoading } from "@/components/home/public-page-loading";
import { PublicPageShell } from "@/components/home/public-page-shell";
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

	return (
		<table className="w-full text-sm">
			<thead>
				<tr className="border-b">
					<th className="py-2 text-left text-xs font-medium text-muted-foreground">Teams</th>
					<th className="py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
					<th className="py-2 text-left text-xs font-medium text-muted-foreground">Date</th>
					<th className="py-2 text-left text-xs font-medium text-muted-foreground">Score</th>
				</tr>
			</thead>
			<tbody>
				{filteredScrims.length === 0 ? (
					<tr>
						<td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
							No scrims match this filter.
						</td>
					</tr>
				) : (
					filteredScrims.map((scrim) => (
						<tr key={scrim.id} className="border-b last:border-0">
							<td className="py-2">
								<p className="font-medium text-sm">
									[{scrim.homeTeam.tag}] {scrim.homeTeam.name}
									{" vs "}
									{scrim.awayTeam ? `[${scrim.awayTeam.tag}] ${scrim.awayTeam.name}` : "TBD"}
								</p>
								{scrim.message && <p className="text-xs text-muted-foreground">{scrim.message}</p>}
							</td>
							<td className="py-2">
								<Badge variant={scrim.status === "disputed" ? "destructive" : "outline"}>
									{SCRIM_STATUS_LABELS[scrim.status]}
								</Badge>
							</td>
							<td className="py-2">
								<span className="text-muted-foreground">
									{formatScheduledAt(scrim.scheduledAt)}
								</span>
							</td>
							<td className="py-2">
								<span className="text-muted-foreground">
									{scrim.homeMapScore} - {scrim.awayMapScore}
								</span>
							</td>
						</tr>
					))
				)}
			</tbody>
		</table>
	);
}
