"use client";

import {
	Add01Icon,
	ArrowDown01Icon,
	CheckmarkCircle01Icon,
	Home01Icon,
	Sword03Icon,
	UserCircle02Icon,
	UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { getWorkspacePathContext } from "@/lib/route-state";
import { appRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useWorkspaceContextStore } from "@/stores/workspace-context";

export interface SwitcherOrg {
	id: string;
	name: string;
	canManage: boolean;
}

export interface SwitcherTeam {
	id: string;
	name: string;
	tag: string;
	organizationId: string;
	organizationName: string;
	canManage: boolean;
}

interface ContextSwitcherProps {
	orgs: SwitcherOrg[];
	teams: SwitcherTeam[];
}

function getActiveLabel(activeOrg: SwitcherOrg | null, activeTeam: SwitcherTeam | null) {
	if (activeTeam) {
		return `[${activeTeam.tag}] ${activeTeam.name}`;
	}

	if (activeOrg) {
		return activeOrg.name;
	}

	return "Personal";
}

function getUnknownContextLabel(activeOrgId: string | null, activeTeamId: string | null) {
	if (activeTeamId) {
		return "Unavailable team workspace";
	}

	if (activeOrgId) {
		return "Unavailable organization workspace";
	}

	return "Personal";
}

function getActiveIcon(activeOrgId: string | null, activeTeamId: string | null) {
	if (activeTeamId) return Sword03Icon;
	if (activeOrgId) return UserGroupIcon;
	return UserCircle02Icon;
}

export function ContextSwitcher({ orgs, teams }: ContextSwitcherProps) {
	const pathname = usePathname();
	const { activeOrgId, activeTeamId, scope } = getWorkspacePathContext(pathname);
	const { isMobile } = useSidebar();
	const { setScope, selectOrg, selectTeam } = useWorkspaceContextStore();
	const [open, setOpen] = useState(false);
	const [createTeamOpen, setCreateTeamOpen] = useState(false);

	const teamsByOrg = useMemo(() => {
		const map = new Map<string, SwitcherTeam[]>();
		for (const team of teams) {
			const existing = map.get(team.organizationId) ?? [];
			existing.push(team);
			map.set(team.organizationId, existing);
		}
		return map;
	}, [teams]);

	const activeOrg = activeOrgId ? (orgs.find((org) => org.id === activeOrgId) ?? null) : null;
	const activeTeam = activeTeamId ? (teams.find((team) => team.id === activeTeamId) ?? null) : null;
	const isWrongContext =
		(scope === "org" && activeOrgId !== null && activeOrg === null) ||
		(scope === "team" && activeTeamId !== null && activeTeam === null);
	const isPersonal = scope === "personal";
	const label = isWrongContext
		? getUnknownContextLabel(activeOrgId, activeTeamId)
		: getActiveLabel(activeOrg, activeTeam);
	const icon = getActiveIcon(activeOrgId, activeTeamId);

	useEffect(() => {
		if (isWrongContext) {
			selectOrg(null);
			selectTeam(null);
			setScope("personal");
			return;
		}
		if (activeTeamId) {
			selectTeam(activeTeamId);
			setScope("team");
			return;
		}
		if (activeOrgId) {
			selectOrg(activeOrgId);
			setScope("org");
			return;
		}
		selectOrg(null);
		selectTeam(null);
		setScope("personal");
	}, [activeOrgId, activeTeamId, isWrongContext, selectOrg, selectTeam, setScope]);

	return (
		<>
			<SidebarMenu>
				<SidebarMenuItem>
					<DropdownMenu open={open} onOpenChange={setOpen}>
						<DropdownMenuTrigger asChild>
							<SidebarMenuButton
								size="lg"
								tooltip="Switch workspace"
								className="gap-3 px-2.5 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								aria-label={`Current workspace: ${label}`}
							>
								<ContextSwitcherTriggerContent
									label={label}
									icon={icon}
									activeOrgId={activeOrgId}
									activeTeamId={activeTeamId}
									isWrongContext={isWrongContext}
								/>
							</SidebarMenuButton>
						</DropdownMenuTrigger>

						<DropdownMenuContent
							className="w-(--radix-dropdown-menu-trigger-width) min-w-80 p-1"
							align="start"
							side={isMobile ? "bottom" : "right"}
							sideOffset={4}
						>
							<DropdownMenuLabel>Switch workspace</DropdownMenuLabel>

							<DropdownMenuGroup>
								<ContextDropdownItem
									href={appRoutes.me}
									icon={UserCircle02Icon}
									label="Personal"
									description="Profile, inbox, and calendar"
									isActive={isPersonal}
									onSelect={() => setOpen(false)}
								/>
							</DropdownMenuGroup>

							{orgs.length > 0 ? <DropdownMenuSeparator /> : null}

							<div className="max-h-96 overflow-y-auto">
								{isWrongContext ? (
									<>
										<DropdownMenuLabel className="pb-1 text-destructive">
											Workspace unavailable
										</DropdownMenuLabel>
										<div className="px-2 pb-2 text-xs text-muted-foreground">
											This URL points to a workspace that is not available to your account. Open a
											workspace below or return to your personal home.
										</div>
										<DropdownMenuSeparator />
									</>
								) : null}
								{orgs.map((org, index) => {
									const orgTeams = teamsByOrg.get(org.id) ?? [];
									return (
										<div key={org.id}>
											<DropdownMenuLabel className="pb-1">{org.name}</DropdownMenuLabel>
											<DropdownMenuGroup>
												<ContextDropdownItem
													href={appRoutes.orgs.byId(org.id)}
													icon={UserGroupIcon}
													label="Organization"
													description="Overview, staff, brand, and settings"
													isActive={activeOrgId === org.id && !activeTeamId}
													onSelect={() => setOpen(false)}
												/>
												{orgTeams.map((team) => (
													<ContextDropdownItem
														key={team.id}
														href={appRoutes.teams.byId(team.id)}
														icon={Sword03Icon}
														label={team.name}
														description={`[${team.tag}] ${team.organizationName}`}
														isActive={activeTeamId === team.id}
														onSelect={() => setOpen(false)}
														indented
													/>
												))}
											</DropdownMenuGroup>
											{index < orgs.length - 1 ? <DropdownMenuSeparator /> : null}
										</div>
									);
								})}
							</div>

							<DropdownMenuSeparator />
							<div className="p-1">
								{activeOrg?.canManage ? (
									<Button
										type="button"
										size="sm"
										className="w-full justify-start"
										onClick={() => {
											setOpen(false);
											setCreateTeamOpen(true);
										}}
									>
										<HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
										Add team
									</Button>
								) : (
									<Button
										asChild
										type="button"
										size="sm"
										variant="outline"
										className="w-full justify-start"
									>
										<Link href={appRoutes.me} onClick={() => setOpen(false)}>
											<HugeiconsIcon icon={Home01Icon} strokeWidth={2} className="size-4" />
											Open personal workspace
										</Link>
									</Button>
								)}
							</div>
						</DropdownMenuContent>
					</DropdownMenu>
				</SidebarMenuItem>
			</SidebarMenu>

			{activeOrg ? (
				<CreateTeamDialog
					orgId={activeOrg.id}
					open={createTeamOpen}
					onOpenChange={setCreateTeamOpen}
				/>
			) : null}
		</>
	);
}

function ContextSwitcherTriggerContent({
	label,
	icon,
	activeOrgId,
	activeTeamId,
	isWrongContext,
	textClassName,
	metaClassName,
}: {
	label: string;
	icon: typeof UserCircle02Icon;
	activeOrgId: string | null;
	activeTeamId: string | null;
	isWrongContext: boolean;
	textClassName?: string;
	metaClassName?: string;
}) {
	return (
		<>
			<div className="flex size-8 shrink-0 items-center justify-center bg-primary/10">
				<HugeiconsIcon icon={icon} strokeWidth={2} className="size-3.5 text-primary" />
			</div>
			<div className="grid min-w-0 flex-1 gap-0.5 text-left leading-tight">
				<span className={cn("truncate text-sm font-medium", textClassName)}>{label}</span>
				<span className={cn("truncate text-xs text-muted-foreground", metaClassName)}>
					{isWrongContext
						? "Choose another workspace"
						: activeTeamId
							? "Team workspace"
							: activeOrgId
								? "Organization workspace"
								: "Personal workspace"}
				</span>
			</div>
			<HugeiconsIcon
				icon={ArrowDown01Icon}
				strokeWidth={2}
				className="ml-auto size-4 shrink-0 opacity-50"
			/>
		</>
	);
}

function ContextDropdownItem({
	href,
	icon,
	label,
	description,
	isActive,
	onSelect,
	indented = false,
}: {
	href: string;
	icon: typeof UserCircle02Icon;
	label: string;
	description: string;
	isActive: boolean;
	onSelect: () => void;
	indented?: boolean;
}) {
	return (
		<DropdownMenuItem asChild className={cn(indented && "pl-6")}>
			<Link href={href} onClick={onSelect}>
				<HugeiconsIcon
					icon={icon}
					strokeWidth={2}
					className={cn("size-4 text-muted-foreground", isActive && "text-primary")}
				/>
				<div className="grid flex-1 text-left leading-tight">
					<span className={cn("truncate font-medium", isActive && "text-foreground")}>{label}</span>
					<span className="truncate text-[11px] text-muted-foreground">{description}</span>
				</div>
				{isActive ? (
					<HugeiconsIcon
						icon={CheckmarkCircle01Icon}
						strokeWidth={2}
						className="ml-auto size-4 text-primary"
					/>
				) : null}
			</Link>
		</DropdownMenuItem>
	);
}
