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
			description="Use this channel for support, product feedback, and project coordination."
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
				<div className="grid gap-3 md:grid-cols-3">
					<div className="border p-4">
						<p className="text-sm font-semibold">Account context</p>
						<p className="mt-2 text-sm text-muted-foreground">
							Your Scrimflow username and whether the issue happened on a public page or inside
							`/app`.
						</p>
					</div>
					<div className="border p-4">
						<p className="text-sm font-semibold">Surface affected</p>
						<p className="mt-2 text-sm text-muted-foreground">
							The team, org, recruiting listing, scrim, or settings page involved.
						</p>
					</div>
					<div className="border p-4">
						<p className="text-sm font-semibold">Expected result</p>
						<p className="mt-2 text-sm text-muted-foreground">
							What you expected to happen and what actually happened instead.
						</p>
					</div>
				</div>
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
					signing in first will speed up the response significantly.
				</p>
			</PublicPageSection>

			<PublicPageSection
				title="Need product context before contacting us?"
				actions={
					<div className="flex flex-wrap gap-2">
						<Button asChild size="sm" variant="outline">
							<Link href={publicRoutes.teams.root}>Browse teams</Link>
						</Button>
						<Button asChild size="sm" variant="outline">
							<Link href={publicRoutes.about}>Read about the platform</Link>
						</Button>
					</div>
				}
			>
				<p className="max-w-[64ch] text-sm leading-relaxed text-muted-foreground">
					If you only need to inspect the product surface, start with public teams, orgs, players,
					recruiting, scrims, and updates. If you need operational help, sign in and gather the
					account context first.
				</p>
			</PublicPageSection>
		</PublicPageShell>
	);
}
