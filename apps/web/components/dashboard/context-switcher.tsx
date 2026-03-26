"use client";

import { CheckmarkCircle01Icon, UserCircle02Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
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
	organizationId?: string;
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

export function ContextSwitcher({ orgs, teams }: ContextSwitcherProps) {
	const pathname = usePathname();
	const label = getActiveLabel(pathname, orgs, teams);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton size="lg" tooltip="Switch context">
					<HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />
					<span>{label}</span>
				</SidebarMenuButton>
			</DropdownMenuTrigger>

			<DropdownMenuContent className="w-72" align="start" side="right">
				<DropdownMenuLabel>Context</DropdownMenuLabel>
				<DropdownMenuItem asChild>
					<Link href="/dashboard/personal/profile" className="flex items-center gap-2">
						<HugeiconsIcon icon={UserCircle02Icon} strokeWidth={2} />
						Personal
						{pathname.startsWith("/dashboard/personal") && (
							<HugeiconsIcon icon={CheckmarkCircle01Icon} strokeWidth={2} className="ml-auto" />
						)}
					</Link>
				</DropdownMenuItem>

				{orgs.length > 0 && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>Organizations</DropdownMenuLabel>
						{orgs.map((org) => {
							const href = `/dashboard/c/org/${org.id}`;
							const isActive = pathname.startsWith(href);
							return (
								<DropdownMenuItem asChild key={org.id}>
									<Link href={href} className="flex items-center gap-2">
										<HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />
										{org.name}
										{isActive && (
											<HugeiconsIcon
												icon={CheckmarkCircle01Icon}
												strokeWidth={2}
												className="ml-auto"
											/>
										)}
									</Link>
								</DropdownMenuItem>
							);
						})}
					</>
				)}

				{teams.length > 0 && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>Teams</DropdownMenuLabel>
						{teams.map((team) => {
							const href = team.organizationId
								? `/dashboard/c/org/${team.organizationId}/team/${team.id}`
								: "/dashboard/organizations";
							const isActive = href !== "/dashboard/organizations" && pathname.startsWith(href);
							return (
								<DropdownMenuItem asChild key={team.id}>
									<Link href={href} className="flex items-center gap-2">
										<span className="text-[10px] text-muted-foreground">[{team.tag}]</span>
										{team.name}
										{isActive && (
											<HugeiconsIcon
												icon={CheckmarkCircle01Icon}
												strokeWidth={2}
												className="ml-auto"
											/>
										)}
									</Link>
								</DropdownMenuItem>
							);
						})}
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
