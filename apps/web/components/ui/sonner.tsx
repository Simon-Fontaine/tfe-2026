"use client";

import {
	Alert02Icon,
	CheckmarkCircle02Icon,
	InformationCircleIcon,
	Loading03Icon,
	MultiplicationSignCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
	const { theme = "system" } = useTheme();

	return (
		<Sonner
			theme={theme as ToasterProps["theme"]}
			className="toaster group"
			icons={{
				success: <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4" />,
				info: <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="size-4" />,
				warning: <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4" />,
				error: (
					<HugeiconsIcon icon={MultiplicationSignCircleIcon} strokeWidth={2} className="size-4" />
				),
				loading: (
					<HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
				),
			}}
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
					"--border-radius": "0px",
				} as React.CSSProperties
			}
			toastOptions={{
				classNames: {
					toast:
						"!rounded-none !border !shadow-none !text-xs !font-normal !ring-1 !ring-foreground/10",
					title: "!text-xs !font-medium",
					description: "!text-xs !text-muted-foreground",
					actionButton: "!rounded-none !text-xs !font-medium",
					cancelButton: "!rounded-none !text-xs !font-medium",
					success:
						"!border-emerald-600/30 !bg-emerald-50 dark:!bg-emerald-950 !text-emerald-700 dark:!text-emerald-400 !ring-emerald-600/20 [&_[data-icon]]:!text-emerald-600",
					error:
						"!border-red-600/30 !bg-red-50 dark:!bg-red-950 !text-red-700 dark:!text-red-400 !ring-red-600/20 [&_[data-icon]]:!text-red-600",
					warning:
						"!border-amber-600/30 !bg-amber-50 dark:!bg-amber-950 !text-amber-700 dark:!text-amber-400 !ring-amber-600/20 [&_[data-icon]]:!text-amber-600",
					info: "!border-blue-600/30 !bg-blue-50 dark:!bg-blue-950 !text-blue-700 dark:!text-blue-400 !ring-blue-600/20 [&_[data-icon]]:!text-blue-600",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };
