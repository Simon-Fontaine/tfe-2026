import { publicRoutes } from "@scrimflow/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
	title: "Contact",
	description: "Get in touch with the Scrimflow team for support or feedback.",
};

export default function ContactPage() {
	return (
		<PublicPageShell
			title="Contact Scrimflow"
			description="Use email for account, workspace, and moderation issues. Include enough context to identify the affected page or workspace."
			contentClassName="space-y-8"
			actions={
				<Button asChild size="sm">
					<Link href={publicRoutes.auth.step("login")}>Sign in first</Link>
				</Button>
			}
		>
			<PublicPageSection title="Support">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Email{" "}
					<a
						href="mailto:support@scrimflow.com"
						className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
					>
						support@scrimflow.com
					</a>{" "}
					for account access, billing-free product support, bug reports, impersonation reports, or
					workspace ownership issues.
				</p>
			</PublicPageSection>

			<PublicPageSection title="What to include">
				<ul className="max-w-[64ch] space-y-2 text-sm text-muted-foreground">
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Who</span>
						<span>Your Scrimflow username and the team or organization involved, if any.</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Where</span>
						<span>The page, scrim, recruiting listing, chat, or settings area affected.</span>
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">What happened</span>
						<span>What you expected, what happened instead, and any error message you saw.</span>
					</li>
				</ul>
			</PublicPageSection>

			<PublicPageSection title="Before you email">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					If you can sign in, check your account and team settings first. For public discovery
					questions, these pages may answer faster than support:{" "}
					<Link
						href={publicRoutes.teams.root}
						className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
					>
						browse teams
					</Link>{" "}
					or{" "}
					<Link
						href={publicRoutes.recruiting.root}
						className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
					>
						recruiting
					</Link>
					.
				</p>
			</PublicPageSection>
		</PublicPageShell>
	);
}
