import { Calendar03Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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

export default async function ScrimsDirectoryPage() {
	const { user } = await getCurrentSession();

	return (
		<PublicPageShell
			title="Scrims"
			description="Recent and upcoming scrims surface scheduling, scorelines, and confirmation state in one place."
			maxWidth="6xl"
			contentClassName="space-y-6"
			actions={
				<Button asChild size="sm">
					<Link href={user ? "/app" : "/auth?step=login"}>
						{user ? "Open team workspace" : "Sign in to manage scrims"}
					</Link>
				</Button>
			}
		>
			<Suspense fallback={<PublicListLoading />}>
				<ScrimsListSection />
			</Suspense>
		</PublicPageShell>
	);
}

async function ScrimsListSection() {
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

	return (
		<div className="space-y-3">
			{scrims.map((scrim) => (
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
