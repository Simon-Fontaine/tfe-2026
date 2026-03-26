import {
	Calendar03Icon,
	Home01Icon,
	Mail01Icon,
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
			{ label: "Home", href: "/", visibility: "all" },
			{ label: "Players", href: "/players", visibility: "all" },
			{ label: "Teams", href: "/teams", visibility: "all" },
			{ label: "Orgs", href: "/orgs", visibility: "all" },
			{ label: "Posts", href: "/posts", visibility: "all" },
			{ label: "Scrims", href: "/scrims", visibility: "all" },
			{ label: "Dashboard", href: "/dashboard", visibility: "auth" },
		],
		// Shown in the header for guests only (auth users have the user dropdown).
		user: [{ label: "Sign in", href: "/auth?step=login", visibility: "guest" }],
		// Sidebar navigation inside the dashboard, split into labelled groups.
		dashboard: [
			{
				links: [{ label: "Dashboard", href: "/dashboard", icon: Home01Icon }],
			},
			{
				label: "Personal",
				links: [
					{ label: "Profile", href: "/dashboard/personal/profile", icon: UserCircle02Icon },
					{ label: "Schedule", href: "/dashboard/personal/schedule", icon: Calendar03Icon },
					{
						label: "Notifications",
						href: "/dashboard/personal/notifications",
						icon: Mail01Icon,
					},
					{ label: "Settings", href: "/dashboard/personal/settings/account", icon: Settings01Icon },
				],
			},
			{
				label: "Discover",
				links: [
					{ label: "Posts", href: "/dashboard/discover/posts", icon: UserSearch01Icon },
					{
						label: "Conversations",
						href: "/dashboard/discover/conversations",
						icon: UserCircle02Icon,
					},
					{ label: "Invitations", href: "/dashboard/discover/invitations", icon: Mail01Icon },
				],
			},
			{
				label: "Workspace",
				links: [{ label: "Organizations", href: "/dashboard/organizations", icon: UserGroupIcon }],
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
