"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
	{ label: "Account", href: "/dashboard/settings" },
	{ label: "Security", href: "/dashboard/settings/security" },
] as const;

export function SettingsSubNav() {
	const pathname = usePathname();

	return (
		<nav className="mb-6 flex gap-1 border-b" aria-label="Settings sections">
			{TABS.map((tab) => {
				const isActive =
					tab.href === "/dashboard/settings"
						? pathname === "/dashboard/settings"
						: pathname.startsWith(tab.href);

				return (
					<Link
						key={tab.href}
						href={tab.href}
						className={cn(
							"-mb-px pb-3 px-1 mr-4 text-sm font-medium transition-colors border-b-2",
							isActive
								? "border-primary text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground"
						)}
						aria-current={isActive ? "page" : undefined}
					>
						{tab.label}
					</Link>
				);
			})}
		</nav>
	);
}
