import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

const FOOTER_GROUPS = [
	{
		title: "Product",
		links: [
			{ label: "Recruiting", href: "/recruiting" },
			{ label: "Teams", href: "/teams" },
			{ label: "Organizations", href: "/orgs" },
			{ label: "Updates", href: "/updates" },
		],
	},
	{
		title: "Trust",
		links: [
			{ label: "About", href: "/about" },
			{ label: "Contact", href: "/contact" },
			{ label: "Terms", href: "/terms" },
			{ label: "Privacy", href: "/privacy" },
		],
	},
] as const;

export function SiteFooter() {
	return (
		<footer className="border-t py-8 text-xs">
			<div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-[1.1fr_1fr]">
				<div className="space-y-3">
					<p className="text-sm font-semibold">{siteConfig.name}</p>
					<p className="max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
						Public pages help visitors evaluate teams, orgs, players, recruiting, scrims, and
						updates before they move into the authenticated workspace.
					</p>
					<p className="text-muted-foreground">
						&copy; {new Date().getFullYear()} {siteConfig.footer.copyright}
					</p>
				</div>
				<div className="grid gap-6 sm:grid-cols-2">
					{FOOTER_GROUPS.map((group) => (
						<nav key={group.title} aria-label={group.title}>
							<p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								{group.title}
							</p>
							<div className="flex flex-col gap-2 text-sm text-muted-foreground">
								{group.links.map((link) => (
									<Link
										key={link.href}
										href={link.href}
										className="transition-colors hover:text-foreground"
									>
										{link.label}
									</Link>
								))}
							</div>
						</nav>
					))}
				</div>
			</div>
		</footer>
	);
}
