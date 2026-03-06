"use client";

import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SettingsSectionCardProps {
	icon?: IconSvgElement;
	title: string;
	description?: string;
	headerRight?: ReactNode;
	id?: string;
	children: ReactNode;
}

export function SettingsSectionCard({
	icon,
	title,
	description,
	headerRight,
	id,
	children,
}: SettingsSectionCardProps) {
	return (
		<Card id={id}>
			<CardHeader className="flex-row items-center justify-between space-y-0">
				<div className="flex items-center gap-2">
					{icon && <HugeiconsIcon icon={icon} strokeWidth={2} className="size-5" />}
					<div>
						<CardTitle>{title}</CardTitle>
						{description && <p className="text-xs text-muted-foreground">{description}</p>}
					</div>
				</div>
				{headerRight}
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}
