import type { Metadata } from "next";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";

export const metadata: Metadata = {
	title: "Privacy Policy",
	description: "What Scrimflow collects, why, and the control you keep over your data.",
};

export default function PrivacyPage() {
	return (
		<PublicPageShell
			title="Privacy Policy"
			description="What we collect, why we collect it, and the control you keep over your data."
			contentClassName="space-y-8"
		>
			<PublicPageSection title="What we collect">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					To run your account and your workspaces, we store your sign-in and security details, your
					player profile, the teams and organizations you belong to, recruiting posts, scrim
					schedules and results, chat messages, notifications, and any images you upload. We only
					collect what the product needs to work.
				</p>
			</PublicPageSection>

			<PublicPageSection title="How we use it">
				<ul className="max-w-[64ch] space-y-2 text-sm text-muted-foreground">
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Access</span>
						<span>
							Signing you in, keeping your session secure, and helping you recover access.
						</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Your workspaces</span>
						<span>Running rosters, recruiting, scrims, chat, updates, and notifications.</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Discovery</span>
						<span>Showing the public profiles, listings, scrims, and updates you publish.</span>
					</li>
				</ul>
			</PublicPageSection>

			<PublicPageSection title="What stays private">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Public pages show only what you publish. Your security settings, active sessions, private
					messages, and anything you haven't published are never shown on public pages.
				</p>
			</PublicPageSection>

			<PublicPageSection title="Your controls">
				<ul className="max-w-[64ch] space-y-2 text-sm text-muted-foreground">
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Profile</span>
						<span>Update or hide your public profile and privacy preferences in settings.</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Recruiting</span>
						<span>Close listings and withdraw applications whenever you want.</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Account</span>
						<span>Export your data or delete your account from account settings.</span>
					</li>
				</ul>
			</PublicPageSection>

			<PublicPageSection title="Who we work with">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					We rely on a small set of providers for hosting, storage, caching, and email so the
					product can run. We don't sell your data, and we don't share it for advertising. If you
					have a privacy question, email{" "}
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
