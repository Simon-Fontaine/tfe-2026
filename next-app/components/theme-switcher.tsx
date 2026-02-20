"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMetaColor } from "@/hooks/use-meta-color";

export function ThemeSwitcher() {
	const { setTheme, resolvedTheme } = useTheme();
	const { setMetaColor, metaColor } = useMetaColor();

	useEffect(() => {
		setMetaColor(metaColor);
	}, [metaColor, setMetaColor]);

	const toggleTheme = useCallback(() => {
		setTheme(resolvedTheme === "dark" ? "light" : "dark");
	}, [resolvedTheme, setTheme]);

	useEffect(() => {
		const handleKeyPress = (event: KeyboardEvent) => {
			if ((event.key === "d" || event.key === "D") && !event.metaKey && !event.ctrlKey) {
				// Ignore if user is typing in an input, textarea, select, or contenteditable
				if (
					(event.target instanceof HTMLElement && event.target.isContentEditable) ||
					event.target instanceof HTMLInputElement ||
					event.target instanceof HTMLTextAreaElement ||
					event.target instanceof HTMLSelectElement
				) {
					return;
				}

				event.preventDefault();
				toggleTheme();
			}
		};

		document.addEventListener("keydown", handleKeyPress);
		return () => document.removeEventListener("keydown", handleKeyPress);
	}, [toggleTheme]);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button variant="ghost" size="icon" onClick={toggleTheme}>
					<SunIcon className="hidden [html.dark_&]:block" />
					<MoonIcon className="hidden [html.light_&]:block" />
					<span className="sr-only">Toggle theme</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent className="flex items-center gap-2 pr-1">
				Toggle Mode <Kbd>D</Kbd>
			</TooltipContent>
		</Tooltip>
	);
}
