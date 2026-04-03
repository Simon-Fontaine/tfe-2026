import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

const FOOTER_LINKS = [
	{ label: "About", href: "/about" },
	{ label: "Contact", href: "/contact" },
	{ label: "Terms", href: "/terms" },
	{ label: "Privacy", href: "/privacy" },
] as const;

export function SiteFooter() {
	return (
		<footer className="py-8 text-xs">
			<div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
				<p className="text-muted-foreground">
					&copy; {new Date().getFullYear()} {siteConfig.footer.copyright} &middot; All rights
					reserved
				</p>
				<nav
					className="flex flex-wrap items-center gap-3 text-muted-foreground"
					aria-label="Footer"
				>
					{FOOTER_LINKS.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className="transition-colors hover:text-foreground"
						>
							{link.label}
						</Link>
					))}
				</nav>
			</div>
		</footer>
	);
}
