"use client";

import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";

interface AuthPanelHeaderProps {
	icon: IconSvgElement;
	iconClassName?: string;
	title: string;
	subtitle?: ReactNode;
	centered?: boolean;
}

export function AuthPanelHeader({
	icon,
	iconClassName = "text-primary",
	title,
	subtitle,
	centered = false,
}: AuthPanelHeaderProps) {
	return (
		<div className={centered ? "text-center" : undefined}>
			{centered && (
				<HugeiconsIcon
					icon={icon}
					strokeWidth={2}
					className={`mx-auto mb-2 size-6 ${iconClassName}`}
					aria-hidden="true"
				/>
			)}
			<h1 className="text-sm font-bold tracking-tight">{title}</h1>
			{subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
		</div>
	);
}
