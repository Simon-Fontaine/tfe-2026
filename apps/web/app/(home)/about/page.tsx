import { publicRoutes } from "@scrimflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
	title: "About",
	description:
		"Scrimflow is a workspace that helps Overwatch 2 teams run their roster, scrims, and recruiting in one place.",
};

export default function AboutPage() {
	return (
		<PublicPageShell
			title="About Scrimflow"
			description="A workspace for Overwatch 2 teams to run the day-to-day, from rosters and scrims to recruiting and updates, all in one place."
			contentClassName="space-y-8"
			actions={
				<Button asChild size="sm">
					<Link href={publicRoutes.auth.step("register")}>Create an account</Link>
				</Button>
			}
		>
			<PublicPageSection title="Why we built it">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Most teams run their season across spreadsheets, Discord threads, and DMs. Plans get
					buried, results never get logged, and someone always ends up chasing the latest version.
					Scrimflow brings the roster, schedule, scrims, and recruiting into one place so players
					and staff can spend less time on logistics and more time playing.
				</p>
			</PublicPageSection>

			<PublicPageSection title="What you can do">
				<ul className="max-w-[64ch] space-y-2 text-sm text-muted-foreground">
					<li className="flex gap-2">
						<span aria-hidden>·</span>
						<span>Build and manage your roster, with staff and player roles.</span>
					</li>
					<li className="flex gap-2">
						<span aria-hidden>·</span>
						<span>Schedule scrims, then log the results and let ratings update.</span>
					</li>
					<li className="flex gap-2">
						<span aria-hidden>·</span>
						<span>Post recruiting listings and handle applications without leaving the app.</span>
					</li>
					<li className="flex gap-2">
						<span aria-hidden>·</span>
						<span>Publish updates and keep team chat next to the work it relates to.</span>
					</li>
				</ul>
			</PublicPageSection>

			<PublicPageSection title="What's public, what's private">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					You decide what the world sees. Profiles, recruiting listings, completed scrims, and
					updates appear on public pages only when you choose to publish them. Everything else in
					your workspace, including chat, settings, and security details, stays private.
				</p>
			</PublicPageSection>

			<PublicPageSection
				title="Where it stands"
				actions={
					<Button asChild size="sm" variant="outline">
						<Link href={publicRoutes.contact}>Contact us</Link>
					</Button>
				}
			>
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Scrimflow is in open beta and free to use while we build it out with the community. If
					something is missing or not working the way you would expect, tell us. Early feedback
					shapes what we work on next.
				</p>
			</PublicPageSection>
		</PublicPageShell>
	);
}
