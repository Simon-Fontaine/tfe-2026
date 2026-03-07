import {
	Home01Icon,
	Settings01Icon,
	Sword03Icon,
	UserCircle02Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

export type NavLink = {
	label: string;
	href: string;
	icon?: IconSvgElement;
	external?: boolean;
	/** "all" = always visible, "auth" = signed-in only, "guest" = signed-out only */
	visibility?: "all" | "auth" | "guest";
};

export type DashboardNavLink = {
	label: string;
	href: string;
	icon: IconSvgElement;
};

export type SiteConfig = {
	name: string;
	description: string;
	logo: IconSvgElement;
	nav: {
		/** Links shown in the top header bar */
		primary: NavLink[];
		/** Guest-only actions (sign in); auth actions are in the user dropdown */
		user: NavLink[];
		/** Sidebar nav for the dashboard */
		dashboard: DashboardNavLink[];
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
		// Desktop-only nav bar links. Authed users also see Dashboard here.
		primary: [{ label: "Dashboard", href: "/dashboard", visibility: "auth" }],
		// Shown in the header for guests only (auth users have the user dropdown).
		user: [{ label: "Sign in", href: "/auth?step=login", visibility: "guest" }],
		// Sidebar navigation inside the dashboard.
		dashboard: [
			{ label: "Dashboard", href: "/dashboard", icon: Home01Icon },
			{ label: "Profile", href: "/dashboard/profile", icon: UserCircle02Icon },
			{ label: "Settings", href: "/dashboard/settings", icon: Settings01Icon },
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
