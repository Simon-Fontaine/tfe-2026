import { Settings01Icon, Sword03Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

export type NavLink = {
	label: string;
	href: string;
	icon?: IconSvgElement;
	external?: boolean;
	/** "all" = always visible, "auth" = signed-in only, "guest" = signed-out only */
	visibility?: "all" | "auth" | "guest";
};

export type SiteConfig = {
	name: string;
	description: string;
	logo: IconSvgElement;
	nav: {
		primary: NavLink[];
		user: NavLink[];
	};
	cta: {
		label: string;
		href: string;
	};
	footer: {
		copyright: string;
	};
};

export const siteConfig: SiteConfig = {
	name: "Scrimflow",
	description: "Overwatch 2 team management and scrim coordination platform.",
	logo: Sword03Icon,
	nav: {
		primary: [
			{ label: "Home", href: "/", visibility: "all" },
			{ label: "Dashboard", href: "/dashboard", visibility: "auth" },
		],
		user: [
			{ label: "Settings", href: "/dashboard/settings", icon: Settings01Icon, visibility: "auth" },
			{ label: "Sign in", href: "/auth?step=login", visibility: "guest" },
		],
	},
	cta: {
		label: "Get started",
		href: "/auth?step=register",
	},
	footer: {
		copyright: "Scrimflow",
	},
};
