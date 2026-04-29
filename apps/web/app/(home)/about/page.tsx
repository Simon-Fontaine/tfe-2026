import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
	title: "About",
	description:
		"Scrimflow helps Overwatch 2 teams run day-to-day operations from a shared workspace.",
};

export default function AboutPage() {
	return (
		<PublicPageShell
			title="About Scrimflow"
			description="Scrimflow helps Overwatch 2 teams run day-to-day operations: roster management, recruiting, and schedule coordination from a shared workspace."
			contentClassName="space-y-8"
			actions={
				<Button asChild size="sm">
					<Link href="/auth?step=register">Create an account</Link>
				</Button>
			}
		>
			<PublicPageSection title="What the platform covers">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Scrimflow is designed to replace the fragmented mix of Discord channels, spreadsheets, and
					manual follow-up that competitive Overwatch 2 teams rely on today. Public pages help
					visitors evaluate teams, orgs, players, recruiting, scrims, and updates before they ever
					enter the authenticated workspace.
				</p>
			</PublicPageSection>

			<PublicPageSection title="What happens after sign-in">
				<div className="grid gap-3 md:grid-cols-3">
					<div className="border p-4">
						<p className="text-sm font-semibold">Personal workspace</p>
						<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
							Manage inbox, calendar, profile, settings, and security from `/app`.
						</p>
					</div>
					<div className="border p-4">
						<p className="text-sm font-semibold">Team operations</p>
						<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
							Run recruiting, scrims, chat, updates, and team administration inside one shell.
						</p>
					</div>
					<div className="border p-4">
						<p className="text-sm font-semibold">Organization control</p>
						<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
							Manage staff, teams, brand, invites, and settings across org-backed programs.
						</p>
					</div>
				</div>
			</PublicPageSection>

			<PublicPageSection
				title="Start with the right surface"
				actions={
					<div className="flex flex-wrap gap-2">
						<Button asChild size="sm" variant="outline">
							<Link href="/recruiting">Browse recruiting</Link>
						</Button>
						<Button asChild size="sm" variant="outline">
							<Link href="/teams">Browse teams</Link>
						</Button>
					</div>
				}
			>
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					If you are evaluating the product, start with the public directories. If you already know
					you need the workspace, create an account and move directly into `/app`.
				</p>
			</PublicPageSection>
		</PublicPageShell>
	);
}
