"use client";

import {
	DashboardSquare01Icon,
	Logout01Icon,
	Menu01Icon,
	Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { logoutAction } from "@/app/dashboard/settings/actions/session";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { type NavLink, siteConfig } from "@/lib/config/site";

interface SiteHeaderProps {
	user?: { email: string; displayName: string; username: string } | null;
}

function isVisible(link: NavLink, isAuthed: boolean) {
	if (!link.visibility || link.visibility === "all") return true;
	return link.visibility === "auth" ? isAuthed : !isAuthed;
}

function NavLinkItem({
	link,
	className,
	size,
}: {
	link: NavLink;
	className?: string;
	size?: "sm" | "default";
}) {
	const linkProps = link.external ? { target: "_blank", rel: "noopener noreferrer" } : {};
	return (
		<Button asChild variant="ghost" size={size} className={className}>
			<Link href={link.href} {...linkProps}>
				{link.icon && <HugeiconsIcon icon={link.icon} strokeWidth={2} className="mr-1.5 size-4" />}
				{link.label}
			</Link>
		</Button>
	);
}

function getInitials(displayName: string) {
	return displayName
		.split(" ")
		.map((w) => w[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

function UserMenu({ user }: { user: { email: string; displayName: string; username: string } }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label="User menu">
					<Avatar>
						<AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuGroup>
					<DropdownMenuItem asChild>
						<Link href="/dashboard">
							<HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />
							Dashboard
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link href="/dashboard/settings">
							<HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
							Settings
						</Link>
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<form action={logoutAction}>
					<DropdownMenuItem asChild>
						<button type="submit" className="w-full">
							<HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
							Sign out
						</button>
					</DropdownMenuItem>
				</form>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function SiteHeader({ user }: SiteHeaderProps) {
	const isAuthed = !!user;

	return (
		<header className="sticky top-0 z-50 border-b bg-background">
			<div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
				<div className="flex items-center gap-6">
					<Link href="/" className="flex items-center gap-2 text-inherit no-underline">
						<HugeiconsIcon icon={siteConfig.logo} strokeWidth={2} className="size-5 text-primary" />
						<span className="text-sm font-bold tracking-tight">{siteConfig.name}</span>
					</Link>

					<nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
						{siteConfig.nav.primary
							.filter((l) => isVisible(l, isAuthed))
							.map((link) => (
								<NavLinkItem key={link.href} link={link} size="sm" />
							))}
					</nav>
				</div>

				<div className="flex items-center gap-2">
					<ThemeToggle />
					<div className="hidden items-center gap-2 md:flex">
						{isAuthed ? (
							<UserMenu user={user} />
						) : (
							<>
								{siteConfig.nav.user
									.filter((l) => isVisible(l, isAuthed))
									.map((link) => (
										<NavLinkItem key={link.href} link={link} size="sm" />
									))}
								<Button asChild size="sm">
									<Link href={siteConfig.cta.href}>{siteConfig.cta.label}</Link>
								</Button>
							</>
						)}
					</div>

					<Sheet>
						<SheetTrigger asChild>
							<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
								<HugeiconsIcon icon={Menu01Icon} strokeWidth={2} className="size-5" />
							</Button>
						</SheetTrigger>
						<SheetContent side="right">
							<SheetHeader>
								<SheetTitle>Navigation</SheetTitle>
								<SheetDescription>Select an option from the menu</SheetDescription>
							</SheetHeader>
							<nav className="mt-4 flex flex-col gap-2" aria-label="Mobile navigation">
								{siteConfig.nav.primary
									.filter((l) => isVisible(l, isAuthed))
									.map((link) => (
										<NavLinkItem key={link.href} link={link} className="justify-start" />
									))}
								<Separator className="my-2" />
								{isAuthed ? (
									<>
										<div className="flex items-center gap-3 px-4 py-2">
											<Avatar size="sm">
												<AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
											</Avatar>
											<div className="flex flex-col">
												<span className="text-sm font-medium">{user.displayName}</span>
												<span className="text-xs text-muted-foreground">{user.email}</span>
											</div>
										</div>
										<Separator className="my-2" />
										<Button asChild variant="ghost" className="justify-start">
											<Link href="/dashboard">
												<HugeiconsIcon
													icon={DashboardSquare01Icon}
													strokeWidth={2}
													className="mr-2 size-4"
												/>
												Dashboard
											</Link>
										</Button>
										<Button asChild variant="ghost" className="justify-start">
											<Link href="/dashboard/settings">
												<HugeiconsIcon
													icon={Settings01Icon}
													strokeWidth={2}
													className="mr-2 size-4"
												/>
												Settings
											</Link>
										</Button>
										<Separator className="my-2" />
										<form action={logoutAction}>
											<Button variant="outline" className="w-full justify-start" type="submit">
												<HugeiconsIcon
													icon={Logout01Icon}
													strokeWidth={2}
													className="mr-2 size-4"
												/>
												Sign out
											</Button>
										</form>
									</>
								) : (
									<>
										{siteConfig.nav.user
											.filter((l) => isVisible(l, isAuthed))
											.map((link) => (
												<NavLinkItem key={link.href} link={link} className="justify-start" />
											))}
										<Button asChild className="justify-start">
											<Link href={siteConfig.cta.href}>{siteConfig.cta.label}</Link>
										</Button>
									</>
								)}
							</nav>
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</header>
	);
}
