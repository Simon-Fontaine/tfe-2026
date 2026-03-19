import {
	Calendar03Icon,
	File01Icon,
	Home01Icon,
	Mail01Icon,
	Search01Icon,
	Settings01Icon,
	Sword03Icon,
	UserCircle02Icon,
	UserGroupIcon,
	UserSearch01Icon,
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

export type DashboardNavGroup = {
	/** Displayed as a group label in the sidebar. Omit for unlabelled groups. */
	label?: string;
	links: DashboardNavLink[];
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
		/** Grouped sidebar nav for the dashboard */
		dashboard: DashboardNavGroup[];
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
		primary: [
			{ label: "Players", href: "/players", visibility: "all" },
			{ label: "Teams", href: "/teams", visibility: "all" },
			{ label: "Organizations", href: "/orgs", visibility: "all" },
			{ label: "Scrims", href: "/scrims", visibility: "all" },
			{ label: "Dashboard", href: "/dashboard", visibility: "auth" },
		],
		// Shown in the header for guests only (auth users have the user dropdown).
		user: [{ label: "Sign in", href: "/auth?step=login", visibility: "guest" }],
		// Sidebar navigation inside the dashboard, split into labelled groups.
		dashboard: [
			{
				links: [
					{ label: "Dashboard", href: "/dashboard", icon: Home01Icon },
					{ label: "Profile", href: "/dashboard/profile", icon: UserCircle02Icon },
					{ label: "My Teams", href: "/dashboard/orgs", icon: UserGroupIcon },
					{ label: "Schedule", href: "/dashboard/schedule", icon: Calendar03Icon },
				],
			},
			{
				label: "Recruit",
				links: [
					{ label: "Find Teams", href: "/dashboard/teams", icon: Search01Icon },
					{ label: "Scrims", href: "/dashboard/scrims", icon: UserSearch01Icon },
					{ label: "Applications", href: "/dashboard/applications", icon: File01Icon },
					{ label: "Invitations", href: "/dashboard/invitations", icon: Mail01Icon },
				],
			},
			{
				links: [{ label: "Settings", href: "/dashboard/settings", icon: Settings01Icon }],
			},
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
