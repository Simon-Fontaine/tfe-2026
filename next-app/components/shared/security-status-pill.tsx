"use client";

import {
	SecurityCheckIcon,
	SecurityWarningIcon,
	Shield01Icon,
	ShieldBanIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@/components/ui/badge";

type SecurityLevel = "secure" | "partial" | "at-risk" | "unknown";

const config: Record<
	SecurityLevel,
	{
		variant: "default" | "secondary" | "destructive" | "outline";
		icon: IconSvgElement;
		label: string;
		className: string;
	}
> = {
	secure: {
		variant: "default",
		icon: SecurityCheckIcon,
		label: "Secure",
		className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
	},
	partial: {
		variant: "default",
		icon: SecurityWarningIcon,
		label: "Partial",
		className: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
	},
	"at-risk": {
		variant: "destructive",
		icon: ShieldBanIcon,
		label: "At Risk",
		className: "",
	},
	unknown: {
		variant: "secondary",
		icon: Shield01Icon,
		label: "Unknown",
		className: "",
	},
};

interface SecurityStatusPillProps {
	level: SecurityLevel;
	label?: string;
}

export function SecurityStatusPill({ level, label }: SecurityStatusPillProps) {
	const cfg = config[level];
	return (
		<Badge variant={cfg.variant} className={cfg.className}>
			<HugeiconsIcon icon={cfg.icon} strokeWidth={2} className="mr-1 size-3.5" />
			{label ?? cfg.label}
		</Badge>
	);
}
