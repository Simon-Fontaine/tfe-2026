import { publicRoutes } from "@scrimflow/shared";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

const FOOTER_GROUPS = [
	{
		title: "Product",
		links: [
			{ label: "Recruiting", href: publicRoutes.recruiting.root },
			{ label: "Teams", href: publicRoutes.teams.root },
			{ label: "Organizations", href: publicRoutes.orgs.root },
			{ label: "Updates", href: publicRoutes.updates.root },
		],
	},
	{
		title: "Trust",
		links: [
			{ label: "About", href: publicRoutes.about },
			{ label: "Contact", href: publicRoutes.contact },
			{ label: "Terms", href: publicRoutes.terms },
			{ label: "Privacy", href: publicRoutes.privacy },
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
						{siteConfig.footer.description}
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
