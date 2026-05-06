import { Sword03Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { appRoutes, publicRoutes } from "@/lib/routes";

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
		/** Links shown in the top header bar */
		primary: NavLink[];
		/** Guest-only actions (sign in); auth actions are in the user dropdown */
		user: NavLink[];
	};
	cta: {
		label: string;
		href: string;
	};
	footer: {
		description: string;
		copyright: string;
	};
};

export const siteConfig: SiteConfig = {
	name: "Scrimflow",
	description: "Overwatch 2 team management and scrim coordination platform.",
	logo: Sword03Icon,
	nav: {
		// Desktop-only nav bar links. Signed-in users also see the app workspace entry here.
		primary: [
			{ label: "Home", href: publicRoutes.home, visibility: "all" },
			{ label: "Players", href: publicRoutes.players.root, visibility: "all" },
			{ label: "Teams", href: publicRoutes.teams.root, visibility: "all" },
			{ label: "Orgs", href: publicRoutes.orgs.root, visibility: "all" },
			{ label: "Recruiting", href: publicRoutes.recruiting.root, visibility: "all" },
			{ label: "Scrims", href: publicRoutes.scrims.root, visibility: "all" },
			{ label: "Updates", href: publicRoutes.updates.root, visibility: "all" },
			{ label: "App", href: appRoutes.root, visibility: "auth" },
		],
		// Shown in the header for guests only (auth users have the user dropdown).
		user: [{ label: "Sign in", href: publicRoutes.auth.step("login"), visibility: "guest" }],
	},
	cta: {
		label: "Get started",
		href: publicRoutes.auth.step("register"),
	},
	footer: {
		description:
			"Scrimflow is an Overwatch 2 team management and scrim coordination platform built to help players, teams, and orgs find each other and grow the competitive scene.",
		copyright: "Scrimflow",
	},
};
