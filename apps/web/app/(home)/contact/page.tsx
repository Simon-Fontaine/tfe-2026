import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageSection } from "@/components/home/public-page-section";
import { PublicPageShell } from "@/components/home/public-page-shell";
import { Button } from "@/components/ui/button";
import { publicRoutes } from "@/lib/routes";

export const metadata: Metadata = {
	title: "Contact",
	description: "Get in touch with the Scrimflow team for support or feedback.",
};

export default function ContactPage() {
	return (
		<PublicPageShell
			title="Contact Scrimflow"
			maxWidth="6xl"
			contentClassName="space-y-6"
			actions={
				<Button asChild size="sm">
					<Link href={publicRoutes.auth.step("login")}>Sign in first</Link>
				</Button>
			}
		>
			<PublicPageSection title="Best way to get help">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Fastest path for support is account-first: create an account, reproduce the issue, then
					include your username plus the team, org, recruiting listing, or page you were using. That
					gives support enough context to act without a long back-and-forth.
				</p>
			</PublicPageSection>

			<PublicPageSection title="What to include in a support request">
				<ul className="max-w-[64ch] space-y-2 text-sm text-muted-foreground">
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Account context</span>— Your
						Scrimflow username and whether the issue happened on a public page or inside{" "}
						<code>/app</code>.
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Surface affected</span>— The
						team, org, recruiting listing, scrim, or settings page involved.
					</li>
					<li className="flex gap-2">
						<span className="shrink-0 font-medium text-foreground">Expected result</span>— What you
						expected to happen and what actually happened instead.
					</li>
				</ul>
			</PublicPageSection>

			<PublicPageSection title="Support contact">
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					Email{" "}
					<a
						href="mailto:support@scrimflow.com"
						className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
					>
						support@scrimflow.com
					</a>{" "}
					with your account username, the surface affected, and a brief description of the issue. We
					aim to respond within 2 business days. For account-state or workspace-level issues,
					signing in first will speed up the response significantly. See also:{" "}
					<Link
						href={publicRoutes.teams.root}
						className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
					>
						browse teams
					</Link>{" "}
					or{" "}
					<Link
						href={publicRoutes.about}
						className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
					>
						read about the platform
					</Link>
					.
				</p>
			</PublicPageSection>
		</PublicPageShell>
	);
}
