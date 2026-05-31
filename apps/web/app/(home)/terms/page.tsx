import type { Metadata } from "next";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";

export const metadata: Metadata = {
	title: "Terms of Service",
	description: "Terms governing use of the Scrimflow platform.",
};

export default function TermsPage() {
	return (
		<PublicPageShell title="Terms of Service" maxWidth="6xl" contentClassName="space-y-6">
			<PublicPageSection title="Use the product truthfully">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Use Scrimflow to represent real teams, organizations, players, and recruiting needs. Do
					not impersonate other people or programs, publish misleading public content, or use the
					workspace to coordinate spam or abuse.
				</p>
				<ul className="mt-4 max-w-[64ch] space-y-2 text-sm text-muted-foreground">
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">No impersonation</span>— Do not
						create accounts, teams, or org profiles that impersonate real people, organizations, or
						other Scrimflow users.
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">No false match reporting</span>—
						Do not confirm scrim results that did not happen or dispute results in bad faith to
						manipulate ratings.
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">No spam or abuse</span>— Do not
						use recruiting listings, chat, or public update posts to distribute unsolicited content
						or coordinate harassment.
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">No credential abuse</span>— Do
						not attempt to bypass authentication controls, share session tokens, or automate account
						creation.
					</li>
				</ul>
			</PublicPageSection>

			<PublicPageSection title="Respect workspace boundaries">
				<ul className="max-w-[64ch] space-y-2 text-sm text-muted-foreground">
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Permissions matter</span>— Only
						org and team members with the right role should manage settings, staff, recruiting, and
						administrative actions.
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">
							Public content stays public
						</span>
						— If you publish org, team, player, recruiting, scrim, or update content, assume it can
						be viewed from the public route family.
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">
							Security flows are mandatory
						</span>
						— Account verification, recovery, and security steps are part of platform access, not
						optional extras.
					</li>
				</ul>
			</PublicPageSection>

			<PublicPageSection title="Account termination">
				<dl className="max-w-[64ch] space-y-3">
					<div>
						<dt className="text-sm font-medium text-foreground">Suspension</dt>
						<dd className="mt-0.5 text-sm text-muted-foreground">
							Accounts that repeatedly violate usage rules may be suspended. Suspended accounts lose
							access to workspace actions but public profile data remains readable while a review is
							in progress.
						</dd>
					</div>
					<div>
						<dt className="text-sm font-medium text-foreground">Permanent removal</dt>
						<dd className="mt-0.5 text-sm text-muted-foreground">
							Accounts found to be impersonating users, manipulating match results, or coordinating
							abuse will be permanently removed. Associated team and org memberships are also
							terminated. Contact{" "}
							<a
								href="mailto:support@scrimflow.com"
								className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
							>
								support@scrimflow.com
							</a>{" "}
							to appeal.
						</dd>
					</div>
				</dl>
			</PublicPageSection>

			<PublicPageSection title="Questions about usage rules">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					If a policy or account-state consequence is unclear, contact support with the affected
					account and workspace context before taking irreversible action.
				</p>
			</PublicPageSection>
		</PublicPageShell>
	);
}
