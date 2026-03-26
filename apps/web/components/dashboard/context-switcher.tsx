"use client";

import {
	Add01Icon,
	CheckmarkCircle01Icon,
	Sword03Icon,
	UserCircle02Icon,
	UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";

export interface SwitcherOrg {
	id: string;
	name: string;
}

export interface SwitcherTeam {
	id: string;
	name: string;
	tag: string;
	organizationId: string;
	organizationName: string;
}

interface ContextSwitcherProps {
	orgs: SwitcherOrg[];
	teams: SwitcherTeam[];
}

function getActiveLabel(pathname: string, orgs: SwitcherOrg[], teams: SwitcherTeam[]) {
	if (pathname.startsWith("/dashboard/personal")) return "Personal";

	const teamMatch = pathname.match(/^\/dashboard\/c\/org\/([^/]+)\/team\/([^/]+)/);
	if (teamMatch) {
		const team = teams.find((item) => item.id === teamMatch[2]);
		return team ? `[${team.tag}] ${team.name}` : "Team";
	}

	const orgMatch = pathname.match(/^\/dashboard\/c\/org\/([^/]+)/);
	if (orgMatch) {
		const org = orgs.find((item) => item.id === orgMatch[1]);
		return org ? org.name : "Organization";
	}

	return "Select context";
}

function getActiveIcon(pathname: string) {
	if (pathname.startsWith("/dashboard/personal")) return UserCircle02Icon;
	if (pathname.match(/\/team\//)) return Sword03Icon;
	if (pathname.match(/\/org\//)) return UserGroupIcon;
	return UserGroupIcon;
}

export function ContextSwitcher({ orgs, teams }: ContextSwitcherProps) {
	const pathname = usePathname();
	const label = getActiveLabel(pathname, orgs, teams);
	const icon = getActiveIcon(pathname);

	// Group teams by org
	const teamsByOrg = new Map<string, SwitcherTeam[]>();
	for (const team of teams) {
		const existing = teamsByOrg.get(team.organizationId) ?? [];
		existing.push(team);
		teamsByOrg.set(team.organizationId, existing);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton size="lg" tooltip="Switch context">
					<HugeiconsIcon icon={icon} strokeWidth={2} />
					<span className="truncate">{label}</span>
				</SidebarMenuButton>
			</DropdownMenuTrigger>

			<DropdownMenuContent className="w-72" align="start" side="right">
				<DropdownMenuLabel>Context</DropdownMenuLabel>

				{/* Personal */}
				<DropdownMenuItem asChild>
					<Link href="/dashboard" className="flex items-center gap-2">
						<HugeiconsIcon icon={UserCircle02Icon} strokeWidth={2} className="size-4" />
						Personal
						{!pathname.startsWith("/dashboard/c/") &&
							!pathname.startsWith("/dashboard/organizations") && (
								<HugeiconsIcon
									icon={CheckmarkCircle01Icon}
									strokeWidth={2}
									className="ml-auto size-4"
								/>
							)}
					</Link>
				</DropdownMenuItem>

				{/* Orgs with their teams grouped */}
				{orgs.length > 0 && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>Organizations</DropdownMenuLabel>
						{orgs.map((org) => {
							const orgHref = `/dashboard/c/org/${org.id}`;
							const isOrgActive = pathname.startsWith(orgHref);
							const orgTeams = teamsByOrg.get(org.id) ?? [];

							return (
								<div key={org.id}>
									<DropdownMenuItem asChild>
										<Link href={orgHref} className="flex items-center gap-2">
											<HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-4" />
											<span className="truncate">{org.name}</span>
											{isOrgActive && !pathname.match(/\/team\//) && (
												<HugeiconsIcon
													icon={CheckmarkCircle01Icon}
													strokeWidth={2}
													className="ml-auto size-4"
												/>
											)}
										</Link>
									</DropdownMenuItem>
									{orgTeams.map((team) => {
										const teamHref = `/dashboard/c/org/${org.id}/team/${team.id}`;
										const isTeamActive = pathname.startsWith(teamHref);
										return (
											<DropdownMenuItem key={team.id} asChild>
												<Link href={teamHref} className="flex items-center gap-2 pl-8">
													<span className="shrink-0 font-mono text-[10px] text-muted-foreground">
														[{team.tag}]
													</span>
													<span className="truncate">{team.name}</span>
													{isTeamActive && (
														<HugeiconsIcon
															icon={CheckmarkCircle01Icon}
															strokeWidth={2}
															className="ml-auto size-4"
														/>
													)}
												</Link>
											</DropdownMenuItem>
										);
									})}
								</div>
							);
						})}
					</>
				)}

				{/* Quick actions */}
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href="/dashboard/organizations" className="flex items-center gap-2">
						<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
						Manage organizations
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
