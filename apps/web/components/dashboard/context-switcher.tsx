"use client";

import {
	Add01Icon,
	ArrowDown01Icon,
	CheckmarkCircle01Icon,
	Search01Icon,
	Sword03Icon,
	UserCircle02Icon,
	UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

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

	return "Personal";
}

function getActiveIcon(pathname: string) {
	if (pathname.match(/\/team\//)) return Sword03Icon;
	if (pathname.match(/\/org\//)) return UserGroupIcon;
	return UserCircle02Icon;
}

function getInitials(name: string) {
	return name
		.split(" ")
		.map((w) => w[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

export function ContextSwitcher({ orgs, teams }: ContextSwitcherProps) {
	const pathname = usePathname();
	const label = getActiveLabel(pathname, orgs, teams);
	const icon = getActiveIcon(pathname);
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");

	const totalItems = orgs.length + teams.length;
	const showSearch = totalItems > 5;

	// Group teams by org
	const teamsByOrg = useMemo(() => {
		const map = new Map<string, SwitcherTeam[]>();
		for (const team of teams) {
			const existing = map.get(team.organizationId) ?? [];
			existing.push(team);
			map.set(team.organizationId, existing);
		}
		return map;
	}, [teams]);

	// Filter by search
	const filteredOrgs = useMemo(() => {
		if (!search) return orgs;
		const q = search.toLowerCase();
		return orgs.filter((org) => {
			const orgTeams = teamsByOrg.get(org.id) ?? [];
			return (
				org.name.toLowerCase().includes(q) ||
				orgTeams.some((t) => t.name.toLowerCase().includes(q) || t.tag.toLowerCase().includes(q))
			);
		});
	}, [orgs, search, teamsByOrg]);

	const isPersonalActive =
		!pathname.startsWith("/dashboard/c/") && !pathname.startsWith("/dashboard/organizations");

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<SidebarMenuButton
					size="lg"
					tooltip="Switch workspace"
					className="bg-sidebar-accent/50 ring-1 ring-sidebar-border data-[state=open]:bg-sidebar-accent"
					aria-label={`Current workspace: ${label}`}
				>
					<div className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-primary/10">
						<HugeiconsIcon icon={icon} strokeWidth={2} className="size-3.5 text-primary" />
					</div>
					<div className="grid flex-1 text-left leading-tight">
						<span className="truncate text-sm font-semibold">{label}</span>
					</div>
					<HugeiconsIcon
						icon={ArrowDown01Icon}
						strokeWidth={2}
						className="ml-auto size-4 opacity-50"
					/>
				</SidebarMenuButton>
			</PopoverTrigger>

			<PopoverContent className="w-72 p-0" align="start" side="right" sideOffset={8}>
				{showSearch && (
					<div className="border-b p-2">
						<div className="relative">
							<HugeiconsIcon
								icon={Search01Icon}
								strokeWidth={2}
								className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								placeholder="Search workspaces..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="h-8 pl-8 text-xs"
							/>
						</div>
					</div>
				)}

				<div className="max-h-80 overflow-y-auto p-1">
					{/* Personal */}
					<ContextItem
						href="/dashboard"
						icon={UserCircle02Icon}
						label="Personal"
						isActive={isPersonalActive}
						onClick={() => setOpen(false)}
					/>

					{/* Orgs with their teams */}
					{filteredOrgs.length > 0 && (
						<>
							<div className="px-2 pb-1 pt-2.5">
								<span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
									Organizations
								</span>
							</div>
							{filteredOrgs.map((org) => {
								const orgHref = `/dashboard/c/org/${org.id}`;
								const isOrgActive = pathname.startsWith(orgHref) && !pathname.match(/\/team\//);
								const orgTeams = teamsByOrg.get(org.id) ?? [];

								const filteredTeams = search
									? orgTeams.filter(
											(t) =>
												t.name.toLowerCase().includes(search.toLowerCase()) ||
												t.tag.toLowerCase().includes(search.toLowerCase())
										)
									: orgTeams;

								return (
									<div key={org.id}>
										<ContextItem
											href={orgHref}
											label={org.name}
											isActive={isOrgActive}
											onClick={() => setOpen(false)}
											avatar={getInitials(org.name)}
										/>
										{filteredTeams.map((team) => {
											const teamHref = `/dashboard/c/org/${org.id}/team/${team.id}`;
											const isTeamActive = pathname.startsWith(teamHref);
											return (
												<ContextItem
													key={team.id}
													href={teamHref}
													label={team.name}
													tag={team.tag}
													isActive={isTeamActive}
													onClick={() => setOpen(false)}
													indent
												/>
											);
										})}
									</div>
								);
							})}
						</>
					)}
				</div>

				{/* Quick actions */}
				<div className="border-t p-1">
					<Link
						href="/dashboard/organizations"
						onClick={() => setOpen(false)}
						className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
					>
						<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5" />
						Manage organizations
					</Link>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function ContextItem({
	href,
	icon,
	label,
	tag,
	isActive,
	onClick,
	avatar,
	indent,
}: {
	href: string;
	icon?: typeof UserCircle02Icon;
	label: string;
	tag?: string;
	isActive: boolean;
	onClick: () => void;
	avatar?: string;
	indent?: boolean;
}) {
	return (
		<Link
			href={href}
			onClick={onClick}
			className={cn(
				"flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground",
				indent && "ml-4",
				isActive && "bg-accent font-medium text-accent-foreground"
			)}
		>
			{icon && (
				<HugeiconsIcon
					icon={icon}
					strokeWidth={2}
					className="size-4 shrink-0 text-muted-foreground"
				/>
			)}
			{avatar && (
				<Avatar className="size-5 shrink-0 rounded-sm">
					<AvatarFallback className="rounded-sm text-[9px]">{avatar}</AvatarFallback>
				</Avatar>
			)}
			{tag && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">[{tag}]</span>}
			<span className="truncate">{label}</span>
			{isActive && (
				<HugeiconsIcon
					icon={CheckmarkCircle01Icon}
					strokeWidth={2}
					className="ml-auto size-3.5 shrink-0 text-primary"
				/>
			)}
		</Link>
	);
}
