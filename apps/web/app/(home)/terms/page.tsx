import type { Metadata } from "next";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";

export const metadata: Metadata = {
	title: "Terms of Service",
	description: "Terms governing use of the Scrimflow platform.",
};

export default function TermsPage() {
	return (
		<PublicPageShell
			title="Terms of Service"
			description="These terms are the practical rules for using Scrimflow. They are short by design."
			contentClassName="space-y-8"
		>
			<PublicPageSection title="Use Scrimflow honestly">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Create accounts, teams, organizations, recruiting listings, scrims, and updates that
					represent real activity. Do not impersonate another person or program, falsify scrim
					results, manipulate ratings, or publish misleading public content.
				</p>
			</PublicPageSection>

			<PublicPageSection title="Respect people and workspaces">
				<ul className="max-w-[64ch] space-y-2 text-sm text-muted-foreground">
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Permissions</span>
						<span>Only use team and organization tools you are authorized to access.</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Conduct</span>
						<span>Do not harass people, spam recruiting listings, or abuse chat and updates.</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Security</span>
						<span>
							Do not share session tokens, bypass access controls, or automate account abuse.
						</span>
					</li>
				</ul>
			</PublicPageSection>

			<PublicPageSection title="Public content">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					If you publish a team, organization, player profile, recruiting listing, scrim, or update,
					expect it to be visible on public Scrimflow pages. Keep private information out of public
					fields.
				</p>
			</PublicPageSection>

			<PublicPageSection title="Moderation">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Accounts or workspaces that violate these rules may lose access to specific actions or be
					suspended. To report impersonation, abuse, or ownership problems, email{" "}
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
