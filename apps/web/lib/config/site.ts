import {
	Calendar03Icon,
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

export type PrimaryRouteReadiness = {
	href: string;
	strategy: "build_now" | "in_development";
	status: string;
	showInPrimaryNavProd: boolean;
	nextAction: string;
};

/**
 * Route readiness checklist for primary navigation:
 * 1) Page has useful read-only value without requiring hidden/internal state.
 * 2) Copy does not imply unavailable functionality.
 * 3) Page includes a concrete next action (CTA or alternate flow).
 * 4) Missing functionality is labeled as in development with explicit status.
 * 5) Analytics/support owner is defined for post-launch feedback.
 */
export const primaryRouteReadiness: PrimaryRouteReadiness[] = [
	{
		href: "/players",
		strategy: "in_development",
		status: "Player directory and profile pages are not implemented yet.",
		showInPrimaryNavProd: false,
		nextAction: "Use Teams directory or dashboard recruiting flows for development testing.",
	},
	{
		href: "/teams",
		strategy: "build_now",
		status: "Public team preview pages are available with read-only recruiting context.",
		showInPrimaryNavProd: true,
		nextAction: "Browse teams or move into authenticated recruiting flows.",
	},
	{
		href: "/orgs",
		strategy: "in_development",
		status: "Organization directory and public org pages are not implemented yet.",
		showInPrimaryNavProd: false,
		nextAction: "Use Teams directory for discovery while org pages are in development.",
	},
	{
		href: "/scrims",
		strategy: "in_development",
		status: "Public scrim listings are not implemented yet.",
		showInPrimaryNavProd: false,
		nextAction: "Use dashboard schedule/workspace flows after sign-in.",
	},
];

const showDevelopmentRoutesInPrimaryNav = process.env.NODE_ENV !== "production";

export const siteConfig: SiteConfig = {
	name: "Scrimflow",
	description: "Overwatch 2 team management and scrim coordination platform.",
	logo: Sword03Icon,
	nav: {
		// Desktop-only nav bar links. Authed users also see Dashboard here.
		primary: [
			...(showDevelopmentRoutesInPrimaryNav
				? [
						{ label: "Players", href: "/players", visibility: "all" as const },
						{ label: "Organizations", href: "/orgs", visibility: "all" as const },
						{ label: "Scrims", href: "/scrims", visibility: "all" as const },
					]
				: []),
			{ label: "Teams", href: "/teams", visibility: "all" },
			{ label: "Dashboard", href: "/dashboard", visibility: "auth" },
		],
		// Shown in the header for guests only (auth users have the user dropdown).
		user: [{ label: "Sign in", href: "/auth?step=login", visibility: "guest" }],
		// Sidebar navigation inside the dashboard, split into labelled groups.
		dashboard: [
			{
				links: [{ label: "Home", href: "/dashboard", icon: Home01Icon }],
			},
			{
				label: "Workspace",
				links: [{ label: "Workspace", href: "/dashboard/workspace", icon: UserGroupIcon }],
			},
			{
				label: "Recruit",
				links: [
					{ label: "LFG Feed", href: "/dashboard/recruit/lfg", icon: UserSearch01Icon },
					{ label: "Find Teams", href: "/dashboard/recruit/teams", icon: Search01Icon },
					{ label: "Inbox", href: "/dashboard/recruit/inbox", icon: Mail01Icon },
				],
			},
			{
				label: "Personal",
				links: [
					{ label: "Profile", href: "/dashboard/me/profile", icon: UserCircle02Icon },
					{ label: "Schedule", href: "/dashboard/me/schedule", icon: Calendar03Icon },
					{ label: "Notifications", href: "/dashboard/me/notifications", icon: Mail01Icon },
					{ label: "Settings", href: "/dashboard/me/settings", icon: Settings01Icon },
				],
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
