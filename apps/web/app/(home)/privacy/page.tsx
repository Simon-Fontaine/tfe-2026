import type { Metadata } from "next";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";

export const metadata: Metadata = {
	title: "Privacy Policy",
	description: "How Scrimflow collects, uses, and protects your data.",
};

export default function PrivacyPage() {
	return (
		<PublicPageShell
			title="Privacy Policy"
			description="Scrimflow stores the data needed to run accounts, teams, recruiting, scrims, chat, and public profiles."
			contentClassName="space-y-8"
		>
			<PublicPageSection title="What we collect">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					We collect account details, security settings, player profile fields, team and
					organization memberships, recruiting content, scrim schedules and results, chat messages,
					notifications, uploaded images, and public update posts.
				</p>
			</PublicPageSection>

			<PublicPageSection title="How we use it">
				<ul className="max-w-[64ch] space-y-2 text-sm text-muted-foreground">
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Access</span>
						<span>To authenticate users, protect sessions, and support account recovery.</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Workspace features</span>
						<span>To run rosters, recruiting, scrims, chat, updates, and notifications.</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Discovery</span>
						<span>To show public profiles, listings, scrims, and updates that users publish.</span>
					</li>
				</ul>
			</PublicPageSection>

			<PublicPageSection title="What is public">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Public pages can include team, organization, player, recruiting, scrim, and update data.
					Private workspace data, security settings, session data, and internal chat are not shown
					on public pages unless a user publishes that information into a public field.
				</p>
			</PublicPageSection>

			<PublicPageSection title="Your controls">
				<ul className="max-w-[64ch] space-y-2 text-sm text-muted-foreground">
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Profile</span>
						<span>You can update your public profile and privacy preferences in settings.</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Recruiting</span>
						<span>You can close listings and withdraw applications where the app allows it.</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Account</span>
						<span>You can request account deletion and data export from account settings.</span>
					</li>
				</ul>
			</PublicPageSection>

			<PublicPageSection title="Service providers">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Scrimflow uses database, cache, object storage, and email delivery services to operate the
					product. We do not sell user data. For privacy questions, email{" "}
					<a
						href="mailto:support@scrimflow.com"
						className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
					>
						support@scrimflow.com
					</a>
					.
				</p>
			</PublicPageSection>
		</PublicPageShell>
	);
}
