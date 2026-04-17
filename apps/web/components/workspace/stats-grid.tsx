import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatItem {
	label: string;
	value: string | number;
	icon?: IconSvgElement;
}

interface StatsGridProps {
	stats: StatItem[];
	columns?: 3 | 4;
	className?: string;
}

const columnClasses = {
	3: "sm:grid-cols-3",
	4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

export function StatsGrid({ stats, columns = 4, className }: StatsGridProps) {
	return (
		<div className={cn("grid gap-3", columnClasses[columns], className)}>
			{stats.map((stat) => (
				<Card key={stat.label}>
					<CardContent className="pt-4">
						<div className="flex items-center gap-2">
							{stat.icon && (
								<HugeiconsIcon
									icon={stat.icon}
									strokeWidth={2}
									className="size-3.5 text-muted-foreground"
								/>
							)}
							<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
								{stat.label}
							</p>
						</div>
						<p className="mt-1 text-2xl font-semibold">{stat.value}</p>
					</CardContent>
				</Card>
			))}
		</div>
	);
}
