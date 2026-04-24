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
			description="This page explains the current product-level data expectations for Scrimflow accounts, public profiles, and workspace activity."
			contentClassName="space-y-8"
		>
			<PublicPageSection title="What data the product needs">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Scrimflow stores account details, public profile information, workspace membership,
					recruiting content, scheduling data, messages, notifications, and supporting security
					settings needed to operate the platform. Public pages only expose data that teams, orgs,
					and players have chosen to publish through the product.
				</p>
			</PublicPageSection>

			<PublicPageSection title="What we store">
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{[
						{
							label: "Account",
							detail:
								"Email address, display name, username, hashed password, session tokens, 2FA credentials, and passkeys.",
						},
						{
							label: "Player profile",
							detail:
								"Battletag, competitive role, rank, hero pool, and any bio or avatar you choose to publish.",
						},
						{
							label: "Team and org membership",
							detail:
								"Roster status, permission role, staff role, and timestamps for team and organization memberships.",
						},
						{
							label: "Recruiting activity",
							detail:
								"Listing content, application messages, and conversation threads linked to your account or teams.",
						},
						{
							label: "Competitive data",
							detail:
								"Scrim schedules, confirmed results, map scores, and rating history derived from completed matches.",
						},
						{
							label: "Communication",
							detail:
								"Team chat messages, notifications, and public update posts. Private messages are workspace-scoped.",
						},
					].map(({ label, detail }) => (
						<div key={label} className="border p-4">
							<p className="text-sm font-semibold">{label}</p>
							<p className="mt-2 text-sm text-muted-foreground">{detail}</p>
						</div>
					))}
				</div>
			</PublicPageSection>

			<PublicPageSection title="How that data is used">
				<div className="grid gap-3 md:grid-cols-3">
					<div className="border p-4">
						<p className="text-sm font-semibold">Account access</p>
						<p className="mt-2 text-sm text-muted-foreground">
							Authentication, session security, and account recovery workflows.
						</p>
					</div>
					<div className="border p-4">
						<p className="text-sm font-semibold">Team operations</p>
						<p className="mt-2 text-sm text-muted-foreground">
							Recruiting, scrim scheduling, chat, updates, notifications, and admin workflows.
						</p>
					</div>
					<div className="border p-4">
						<p className="text-sm font-semibold">Public discovery</p>
						<p className="mt-2 text-sm text-muted-foreground">
							Public org, team, player, recruiting, scrim, and updates pages.
						</p>
					</div>
				</div>
			</PublicPageSection>

			<PublicPageSection title="Data you control">
				<ul className="max-w-[64ch] space-y-2 text-sm text-muted-foreground">
					<li className="flex gap-2">
						<span className="mt-0.5 shrink-0 font-medium text-foreground">Public profile</span>— You
						choose which fields (bio, avatar, hero pool, battletag) appear on your public player
						page.
					</li>
					<li className="flex gap-2">
						<span className="mt-0.5 shrink-0 font-medium text-foreground">Recruiting listings</span>
						— You control whether listings are open or closed and can withdraw them at any time.
					</li>
					<li className="flex gap-2">
						<span className="mt-0.5 shrink-0 font-medium text-foreground">Team membership</span>—
						You can leave a team or org at any time. Roster entries are removed; historical scrim
						records are preserved for result integrity.
					</li>
					<li className="flex gap-2">
						<span className="mt-0.5 shrink-0 font-medium text-foreground">Account deletion</span>—
						Full account deletion removes your auth credentials, profile, and workspace memberships.
						Contact support to begin the process.
					</li>
				</ul>
			</PublicPageSection>

			<PublicPageSection title="Third-party services">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Scrimflow does not sell your data to third parties. The platform uses PostgreSQL for
					structured data, Redis for session state and rate limiting, and object storage for
					uploaded images. Email delivery uses an SMTP relay for verification and recovery flows
					only — no marketing email is sent without your explicit consent. Contact{" "}
					<a
						href="mailto:support@scrimflow.gg"
						className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
					>
						support@scrimflow.gg
					</a>{" "}
					to request account data or deletion.
				</p>
			</PublicPageSection>
		</PublicPageShell>
	);
}
