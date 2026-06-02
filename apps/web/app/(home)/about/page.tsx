import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { Button } from "@/components/ui/button";
import { publicRoutes } from "@/lib/routes";

export const metadata: Metadata = {
	title: "About",
	description:
		"Scrimflow helps Overwatch 2 teams run day-to-day operations from a shared workspace.",
};

export default function AboutPage() {
	return (
		<PublicPageShell
			title="About Scrimflow"
			description="Scrimflow is an Overwatch 2 team management workspace for rosters, recruiting, scrims, updates, and day-to-day coordination."
			contentClassName="space-y-8"
			actions={
				<Button asChild size="sm">
					<Link href={publicRoutes.auth.step("register")}>Create an account</Link>
				</Button>
			}
		>
			<PublicPageSection title="What it is for">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Scrimflow helps players, teams, and organizations keep competitive operations in one
					place. Teams can manage rosters, publish recruiting needs, schedule scrims, review
					results, post updates, and keep team conversations tied to the work they support.
				</p>
			</PublicPageSection>

			<PublicPageSection title="What is public">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Public pages show the information teams, organizations, and players choose to publish:
					profiles, recruiting listings, public scrims, and updates. Private workspace data stays
					inside the app.
				</p>
			</PublicPageSection>

			<PublicPageSection title="What is inside the app">
				<ul className="max-w-[64ch] space-y-2 text-sm text-muted-foreground">
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Personal workspace</span>
						<span>Inbox, calendar, profile, privacy, account, and security settings.</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Team workspace</span>
						<span>Roster, schedule, scrims, chat, recruiting, updates, and team settings.</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Organization workspace</span>
						<span>Teams, staff, brand profile, updates, and ownership controls.</span>
					</li>
				</ul>
			</PublicPageSection>

			<PublicPageSection
				title="Start here"
				actions={
					<div className="flex flex-wrap gap-2">
						<Button asChild size="sm" variant="outline">
							<Link href={publicRoutes.recruiting.root}>Browse recruiting</Link>
						</Button>
						<Button asChild size="sm" variant="outline">
							<Link href={publicRoutes.teams.root}>Browse teams</Link>
						</Button>
					</div>
				}
			>
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Browse public pages to find teams, players, and recruiting opportunities. Sign in when you
					need to manage your own profile, team, organization, or scrim workflow.
				</p>
			</PublicPageSection>
		</PublicPageShell>
	);
}
