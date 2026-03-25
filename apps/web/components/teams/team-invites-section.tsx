"use client";

import { cancelTeamInviteAction } from "@/app/dashboard/teams/[teamId]/actions/invites";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import type { TeamPendingInvite } from "@/lib/data/team";

interface TeamInvitesSectionProps {
	invites: TeamPendingInvite[];
}

const ROLE_LABELS: Record<string, string> = {
	tank: "Tank",
	damage: "DPS",
	support: "Support",
};

function formatExpiry(iso: string): string {
	const date = new Date(iso);
	const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
	return days <= 1 ? "Expires soon" : `Expires in ${days}d`;
}

function CancelInviteButton({ inviteId }: { inviteId: string }) {
	const { submit, isPending } = useFormAction(cancelTeamInviteAction, {
		successMessage: "Invite cancelled",
	});

	function handleCancel() {
		const fd = new FormData();
		fd.set("inviteId", inviteId);
		submit(fd);
	}

	return (
		<Button
			size="sm"
			variant="outline"
			onClick={handleCancel}
			disabled={isPending}
			className="shrink-0"
		>
			{isPending && <Spinner className="mr-1.5" />}
			Cancel
		</Button>
	);
}

export function TeamInvitesSection({ invites }: TeamInvitesSectionProps) {
	if (invites.length === 0) {
		return <p className="text-xs text-muted-foreground">No pending invites.</p>;
	}

	return (
		<div className="space-y-2">
			{invites.map((invite) => (
				<div key={invite.id} className="flex items-center gap-3 border px-4 py-3">
					<Avatar className="size-8 shrink-0 overflow-hidden rounded-none after:rounded-none">
						<AvatarImage src={invite.inviteeAvatarUrl ?? undefined} className="rounded-none" />
						<AvatarFallback className="rounded-none text-[10px] font-bold">
							{invite.inviteeDisplayName.slice(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<p className="truncate text-xs font-medium">{invite.inviteeDisplayName}</p>
						<div className="mt-0.5 flex items-center gap-2">
							<Badge variant="outline" className="text-[10px]">
								{ROLE_LABELS[invite.roleInTeam] ?? invite.roleInTeam}
							</Badge>
							<span className="text-[10px] text-muted-foreground">
								{formatExpiry(invite.expiresAt)}
							</span>
						</div>
					</div>
					<CancelInviteButton inviteId={invite.id} />
				</div>
			))}
		</div>
	);
}
