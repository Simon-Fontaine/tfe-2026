import { publicRoutes } from "@scrimflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";

export const metadata: Metadata = {
	title: "Contact",
	description: "How to reach the Scrimflow team for support, bug reports, or feedback.",
};

export default function ContactPage() {
	return (
		<PublicPageShell
			title="Contact Scrimflow"
			description="Need a hand or want to flag something? Email is the fastest way to reach us."
			contentClassName="space-y-8"
		>
			<PublicPageSection title="Email support">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Reach us at{" "}
					<a
						href="mailto:support@scrimflow.com"
						className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
					>
						support@scrimflow.com
					</a>{" "}
					for account access, bug reports, impersonation or abuse reports, and workspace ownership
					questions.
				</p>
			</PublicPageSection>

			<PublicPageSection title="Help us help you">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					A little context gets you a faster answer. When you write in, it helps to include:
				</p>
				<ul className="max-w-[64ch] space-y-2 text-sm text-muted-foreground">
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Who</span>
						<span>
							Your Scrimflow username, and the team or organization involved if there is one.
						</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Where</span>
						<span>The page, scrim, listing, chat, or settings area where it happened.</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">What happened</span>
						<span>What you expected, what happened instead, and any error message you saw.</span>
					</li>
				</ul>
			</PublicPageSection>

			<PublicPageSection title="Try this first">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					If you can sign in, your account and team settings cover most common questions. Looking
					for a roster or players? Browsing{" "}
					<Link
						href={publicRoutes.teams.root}
						className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
					>
						teams
					</Link>{" "}
					or{" "}
					<Link
						href={publicRoutes.recruiting.root}
						className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
					>
						recruiting
					</Link>{" "}
					is often quicker than waiting on a reply.
				</p>
			</PublicPageSection>
		</PublicPageShell>
	);
}
