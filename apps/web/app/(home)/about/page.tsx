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
			contentClassName="space-y-8"
			actions={
				<Button asChild size="sm">
					<Link href={publicRoutes.auth.step("register")}>Create an account</Link>
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
				<ul className="max-w-[64ch] space-y-2 text-sm text-muted-foreground">
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Personal workspace</span>— Manage
						inbox, calendar, profile, settings, and security from <code>/app</code>.
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Team operations</span>— Run
						recruiting, scrims, chat, updates, and team administration inside one shell.
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Organization control</span>—
						Manage staff, teams, brand, invites, and settings across org-backed programs.
					</li>
				</ul>
			</PublicPageSection>

			<PublicPageSection
				title="Start with the right surface"
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
					If you are evaluating the product, start with the public directories. If you already know
					you need the workspace, create an account and move directly into <code>/app</code>.
				</p>
			</PublicPageSection>
		</PublicPageShell>
	);
}
