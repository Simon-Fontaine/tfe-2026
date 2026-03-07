"use client";

import { Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { getUserInitials, UserMenuDropdown } from "@/components/shared/user-menu-dropdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
	user?: { email: string; displayName: string; username: string; avatarUrl: string | null } | null;
}

function isVisible(link: NavLink, isAuthed: boolean) {
	if (!link.visibility || link.visibility === "all") return true;
	return link.visibility === "auth" ? isAuthed : !isAuthed;
}

export function SiteHeader({ user }: SiteHeaderProps) {
	const isAuthed = !!user;
	const visiblePrimary = siteConfig.nav.primary.filter((l) => isVisible(l, isAuthed));

	return (
		<header className="sticky top-0 z-50 border-b bg-background">
			<div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
				{/* Left: logo + desktop nav */}
				<div className="flex items-center gap-6">
					<Link href="/" className="flex items-center gap-2 text-inherit no-underline">
						<HugeiconsIcon icon={siteConfig.logo} strokeWidth={2} className="size-5 text-primary" />
						<span className="text-sm font-bold tracking-tight">{siteConfig.name}</span>
					</Link>

					{visiblePrimary.length > 0 && (
						<nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
							{visiblePrimary.map((link) => (
								<Button key={link.href} asChild variant="ghost" size="sm">
									<Link href={link.href}>
										{link.icon && (
											<HugeiconsIcon icon={link.icon} strokeWidth={2} className="mr-1.5 size-4" />
										)}
										{link.label}
									</Link>
								</Button>
							))}
						</nav>
					)}
				</div>

				{/* Right: account actions (always visible) + mobile nav trigger */}
				<div className="flex items-center gap-2">
					{isAuthed ? (
						<UserMenuDropdown user={user}>
							<Button variant="ghost" size="icon" className="size-9" aria-label="User menu">
								<Avatar className="size-7 rounded-none overflow-hidden after:rounded-none">
									<AvatarImage className="rounded-none" src={user.avatarUrl || undefined} />
									<AvatarFallback className="rounded-none text-xs">
										{getUserInitials(user.displayName)}
									</AvatarFallback>
								</Avatar>
							</Button>
						</UserMenuDropdown>
					) : (
						<>
							<ThemeToggle />
							<Button asChild variant="ghost" size="sm" className="hidden sm:flex">
								<Link href="/auth?step=login">Sign in</Link>
							</Button>
							<Button asChild size="sm">
								<Link href={siteConfig.cta.href}>{siteConfig.cta.label}</Link>
							</Button>
						</>
					)}

					{/* Mobile nav sheet — primary links only, no account actions */}
					{visiblePrimary.length > 0 && (
						<Sheet>
							<SheetTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="md:hidden"
									aria-label="Open navigation"
								>
									<HugeiconsIcon icon={Menu01Icon} strokeWidth={2} className="size-5" />
								</Button>
							</SheetTrigger>
							<SheetContent side="right" className="p-0">
								<SheetHeader className="flex h-16 flex-row items-center border-b px-2">
									<SheetTitle className="sr-only">Navigation</SheetTitle>
									<SheetDescription className="sr-only">Site navigation links</SheetDescription>
									<Link href="/" className="flex items-center gap-2 text-inherit no-underline">
										<div className="flex size-8 items-center justify-center border bg-primary/10">
											<HugeiconsIcon
												icon={siteConfig.logo}
												strokeWidth={2}
												className="size-4 text-primary"
											/>
										</div>
										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate font-semibold">{siteConfig.name}</span>
											<span className="truncate text-xs text-muted-foreground">Overwatch 2</span>
										</div>
									</Link>
								</SheetHeader>
								<nav className="p-2" aria-label="Mobile navigation">
									<p className="px-2 py-1 text-xs font-medium text-muted-foreground">Navigation</p>
									<div className="flex flex-col gap-0.5">
										{visiblePrimary.map((link) => (
											<Button key={link.href} asChild variant="ghost" className="justify-start">
												<Link href={link.href}>
													{link.icon && (
														<HugeiconsIcon icon={link.icon} strokeWidth={2} className="size-4" />
													)}
													{link.label}
												</Link>
											</Button>
										))}
									</div>
								</nav>
							</SheetContent>
						</Sheet>
					)}
				</div>
			</div>
		</header>
	);
}
