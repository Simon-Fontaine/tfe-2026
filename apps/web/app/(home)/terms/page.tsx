import type { Metadata } from "next";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";

export const metadata: Metadata = {
	title: "Terms of Service",
	description: "The ground rules for using Scrimflow.",
};

export default function TermsPage() {
	return (
		<PublicPageShell
			title="Terms of Service"
			description="The ground rules for using Scrimflow. Short, plain, and meant to keep things fair."
			contentClassName="space-y-8"
		>
			<PublicPageSection title="Play it straight">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Set up accounts, teams, organizations, recruiting listings, scrims, and updates that
					reflect real activity. Don't impersonate another person or team, fake scrim results,
					manipulate ratings, or post misleading information on public pages.
				</p>
			</PublicPageSection>

			<PublicPageSection title="Respect people and workspaces">
				<ul className="max-w-[64ch] space-y-2 text-sm text-muted-foreground">
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Permissions</span>
						<span>Use only the team and organization tools you've been given access to.</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Conduct</span>
						<span>Don't harass people, spam recruiting listings, or abuse chat and updates.</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Security</span>
						<span>Don't share session tokens, work around access controls, or automate abuse.</span>
					</li>
				</ul>
			</PublicPageSection>

			<PublicPageSection title="Anything public is public">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					When you publish a team, organization, profile, recruiting listing, scrim, or update,
					treat it as visible to anyone. Keep private details out of public fields.
				</p>
			</PublicPageSection>

			<PublicPageSection title="When rules are broken">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					We may limit specific actions, or suspend accounts and workspaces, when these rules are
					broken. To report impersonation, abuse, or an ownership dispute, email{" "}
					<a
						href="mailto:support@scrimflow.com"
						className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
					>
						support@scrimflow.com
					</a>
					.
				</p>
			</PublicPageSection>

			<p className="text-xs text-muted-foreground">Last updated June 3, 2026.</p>
		</PublicPageShell>
	);
}
