"use client";

import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

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
			<CardHeader>
				<div className="flex items-center gap-2">
					{icon && <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" />}
					<CardTitle>{title}</CardTitle>
				</div>
				{description && <CardDescription>{description}</CardDescription>}
				{headerRight && <CardAction>{headerRight}</CardAction>}
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}
