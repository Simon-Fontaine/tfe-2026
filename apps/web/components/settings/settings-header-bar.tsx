import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface SettingsHeaderBarProps {
	backHref: string;
	icon: IconSvgElement;
	title: string;
	subtitle?: string;
}

export function SettingsHeaderBar({ backHref, icon, title, subtitle }: SettingsHeaderBarProps) {
	return (
		<div className="mb-8">
			<Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
				<Link href={backHref}>
					<HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="mr-1.5 size-4" />
					Back
				</Link>
			</Button>
			<div className="flex items-center gap-3">
				<div className="flex size-8 items-center justify-center border bg-primary/10">
					<HugeiconsIcon icon={icon} strokeWidth={2} className="size-4 text-primary" />
				</div>
				<div>
					<h1 className="text-sm font-bold">{title}</h1>
					{subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
				</div>
			</div>
		</div>
	);
}
