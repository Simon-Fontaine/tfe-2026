"use client";

import { UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { respondToApplicationAction } from "@/app/dashboard/scrims/actions/lfg";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import type { LfgApplicationSummary } from "@/lib/data/lfg";
import { cn } from "@/lib/utils";

const RANK_LABELS: Record<string, string> = {
	bronze: "Bronze",
	silver: "Silver",
	gold: "Gold",
	platinum: "Platinum",
	diamond: "Diamond",
	master: "Master",
	grandmaster: "Grandmaster",
	champion: "Champion",
};

const ROLE_LABELS: Record<string, string> = {
	tank: "Tank",
	damage: "DPS",
	support: "Support",
};

const OW2_ROLES = [
	{ value: "tank", label: "Tank" },
	{ value: "damage", label: "DPS" },
	{ value: "support", label: "Support" },
] as const;

interface TeamApplicationsSectionProps {
	applications: LfgApplicationSummary[];
	orgId: string;
	teamId: string;
}

function ApplicationCard({
	app,
	orgId,
	teamId,
}: {
	app: LfgApplicationSummary;
	orgId: string;
	teamId: string;
}) {
	const [roleInTeam, setRoleInTeam] = useState<"tank" | "damage" | "support">(
		(app.applicantPrimaryRole as "tank" | "damage" | "support") ?? "damage"
	);

	const { submit, isPending } = useFormAction(respondToApplicationAction, {
		loadingMessage: "Processing…",
		successMessage: "Response sent",
	});

	function respond(action: "accept" | "reject") {
		const fd = new FormData();
		fd.set("postId", app.postId);
		fd.set("applicationId", app.id);
		fd.set("orgId", orgId);
		fd.set("teamId", teamId);
		fd.set("action", action);
		if (action === "accept") fd.set("roleInTeam", roleInTeam);
		submit(fd);
	}

	return (
		<div className="space-y-3 border p-4">
			<div className="flex items-start gap-3">
				<Avatar className="size-9 shrink-0 overflow-hidden rounded-none after:rounded-none">
					<AvatarImage src={app.applicantAvatarUrl ?? undefined} className="rounded-none" />
					<AvatarFallback className="rounded-none text-[10px]">
						<HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-3" />
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-medium">{app.applicantDisplayName}</p>
					<div className="mt-0.5 flex items-center gap-2">
						{app.applicantPrimaryRole && (
							<Badge variant="outline" className="text-[10px]">
								{ROLE_LABELS[app.applicantPrimaryRole] ?? app.applicantPrimaryRole}
							</Badge>
						)}
						{app.applicantRank && (
							<Badge variant="secondary" className="text-[10px]">
								{RANK_LABELS[app.applicantRank] ?? app.applicantRank}
							</Badge>
						)}
					</div>
					{app.message && (
						<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{app.message}</p>
					)}
				</div>
			</div>

			<div className="flex items-center gap-3">
				<div className="flex gap-1.5">
					{OW2_ROLES.map((r) => (
						<button
							key={r.value}
							type="button"
							data-selected={roleInTeam === r.value}
							onClick={() => setRoleInTeam(r.value)}
							className={cn(
								"border px-2.5 py-1 text-[10px] font-medium transition-colors hover:bg-muted",
								"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
							)}
						>
							{r.label}
						</button>
					))}
				</div>
				<div className="ml-auto flex gap-2">
					<Button size="sm" onClick={() => respond("accept")} disabled={isPending}>
						{isPending && <Spinner className="mr-1.5" />}
						Accept
					</Button>
					<Button
						size="sm"
						variant="outline"
						onClick={() => respond("reject")}
						disabled={isPending}
					>
						Reject
					</Button>
				</div>
			</div>
		</div>
	);
}

export function TeamApplicationsSection({
	applications,
	orgId,
	teamId,
}: TeamApplicationsSectionProps) {
	if (applications.length === 0) {
		return <p className="text-xs text-muted-foreground">No pending applications.</p>;
	}

	return (
		<div className="space-y-3">
			{applications.map((app) => (
				<ApplicationCard key={app.id} app={app} orgId={orgId} teamId={teamId} />
			))}
		</div>
	);
}
