import {
	CheckmarkCircle01Icon,
	Search01Icon,
	UserCircle02Icon,
	UserGroupIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlayerProfileFull } from "@/lib/data/player";
import { cn } from "@/lib/utils";

interface ChecklistCardProps {
	icon: IconSvgElement;
	title: string;
	description: string;
	ctaLabel: string;
	ctaHref: string;
	comingSoon?: boolean;
	done?: boolean;
}

function ChecklistCard({
	icon,
	title,
	description,
	ctaLabel,
	ctaHref,
	comingSoon,
	done,
}: ChecklistCardProps) {
	return (
		<div className={cn("flex items-start gap-4 border p-4", comingSoon && "opacity-60")}>
			<div
				className={cn(
					"mt-0.5 flex size-8 shrink-0 items-center justify-center",
					done ? "bg-primary/10 text-primary" : "bg-muted"
				)}
			>
				{done ? (
					<HugeiconsIcon
						icon={CheckmarkCircle01Icon}
						strokeWidth={2}
						className="size-4 text-primary"
					/>
				) : (
					<HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" />
				)}
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<p className="text-sm font-semibold">{title}</p>
					{comingSoon && (
						<Badge variant="secondary" className="text-[10px]">
							Coming soon
						</Badge>
					)}
					{done && <Badge className="bg-primary/10 text-primary text-[10px] border-0">Done</Badge>}
				</div>
				<p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
			</div>
			{!comingSoon && !done && (
				<Button asChild size="sm" variant="outline" className="shrink-0">
					<Link href={ctaHref}>{ctaLabel}</Link>
				</Button>
			)}
		</div>
	);
}

interface GettingStartedSectionProps {
	profile: PlayerProfileFull | null;
}

export function GettingStartedSection({ profile }: GettingStartedSectionProps) {
	// Profile is "complete" if the user has a battletag set
	const profileDone = !!profile?.battletag;

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm">Get started</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				<ChecklistCard
					icon={UserCircle02Icon}
					title="Complete your profile"
					description="Add your BattleTag, rank, hero pool and availability to attract the right teams."
					ctaLabel="Set up"
					ctaHref="/dashboard/profile"
					done={profileDone}
				/>
				<ChecklistCard
					icon={UserGroupIcon}
					title="Create or join an organisation"
					description="Organisations manage one or more teams and handle scrim invitations."
					ctaLabel="Browse orgs"
					ctaHref="/dashboard/orgs"
					comingSoon
				/>
				<ChecklistCard
					icon={Search01Icon}
					title="Find scrims"
					description="Browse the LFG board or invite another team to a scrim directly."
					ctaLabel="Find scrims"
					ctaHref="/dashboard/scrims"
					comingSoon
				/>
			</CardContent>
		</Card>
	);
}
