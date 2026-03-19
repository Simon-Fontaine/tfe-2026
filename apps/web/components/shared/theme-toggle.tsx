"use client";

import { ComputerIcon, Moon02Icon, Sun02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
	const { setTheme } = useTheme();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="Toggle theme">
					<HugeiconsIcon
						icon={Sun02Icon}
						strokeWidth={2}
						className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
					/>
					<HugeiconsIcon
						icon={Moon02Icon}
						strokeWidth={2}
						className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
					/>
					<span className="sr-only">Toggle theme</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => setTheme("light")}>
					<HugeiconsIcon icon={Sun02Icon} strokeWidth={2} className="mr-2 size-4" />
					Light
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setTheme("dark")}>
					<HugeiconsIcon icon={Moon02Icon} strokeWidth={2} className="mr-2 size-4" />
					Dark
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setTheme("system")}>
					<HugeiconsIcon icon={ComputerIcon} strokeWidth={2} className="mr-2 size-4" />
					System
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
