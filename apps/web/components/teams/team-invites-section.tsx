"use client";

import { cancelTeamInviteAction, resendTeamInviteAction } from "@/app/actions/team";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import type { TeamPendingInvite } from "@/lib/data/team";

interface TeamInvitesSectionProps {
	teamId: string;
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

function InviteActions({ teamId, inviteId }: { teamId: string; inviteId: string }) {
	const cancelForm = useFormAction(cancelTeamInviteAction, { successMessage: "Invite cancelled" });
	const resendForm = useFormAction(resendTeamInviteAction, { successMessage: "Invite resent" });
	const isPending = cancelForm.isPending || resendForm.isPending;

	function submitCancel() {
		const fd = new FormData();
		fd.set("teamId", teamId);
		fd.set("inviteId", inviteId);
		cancelForm.submit(fd);
	}

	function submitResend() {
		const fd = new FormData();
		fd.set("teamId", teamId);
		fd.set("inviteId", inviteId);
		resendForm.submit(fd);
	}

	return (
		<div className="space-y-2">
			<div className="flex shrink-0 flex-wrap gap-2">
				<Button size="sm" variant="outline" onClick={submitResend} disabled={isPending}>
					{resendForm.isPending && <Spinner className="mr-1.5" />}
					Resend
				</Button>
				<Button size="sm" variant="outline" onClick={submitCancel} disabled={isPending}>
					{cancelForm.isPending && <Spinner className="mr-1.5" />}
					Cancel
				</Button>
			</div>
			{cancelForm.state?.error || resendForm.state?.error ? (
				<Alert variant="destructive">
					<AlertDescription>{cancelForm.state?.error ?? resendForm.state?.error}</AlertDescription>
				</Alert>
			) : null}
		</div>
	);
}

export function TeamInvitesSection({ teamId, invites }: TeamInvitesSectionProps) {
	if (invites.length === 0) {
		return <p className="text-xs text-muted-foreground">No pending invites.</p>;
	}

	return (
		<div className="space-y-2">
			{invites.map((invite) => (
				<div key={invite.id} className="flex flex-wrap items-center gap-3 border px-4 py-3">
					<Avatar className="size-8 shrink-0 overflow-hidden rounded-none after:rounded-none">
						<AvatarImage src={invite.inviteeAvatarUrl ?? undefined} className="rounded-none" />
						<AvatarFallback className="rounded-none text-[10px] font-bold">
							{invite.inviteeDisplayName.slice(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<p className="truncate text-xs font-medium">{invite.inviteeDisplayName}</p>
						<div className="mt-0.5 flex flex-wrap items-center gap-2">
							<Badge variant="outline" className="text-[10px]">
								{invite.roleInTeam
									? (ROLE_LABELS[invite.roleInTeam] ?? invite.roleInTeam)
									: invite.staffRole
										? invite.staffRole[0].toUpperCase() + invite.staffRole.slice(1)
										: "Staff"}
							</Badge>
							{invite.permissionRole === "admin" && (
								<Badge variant="outline" className="text-[10px]">
									Admin access
								</Badge>
							)}
							{invite.permissionRole === "member" && (
								<Badge variant="outline" className="text-[10px]">
									Member access
								</Badge>
							)}
							<span className="text-[10px] text-muted-foreground">
								{formatExpiry(invite.expiresAt)}
							</span>
						</div>
					</div>
					<InviteActions teamId={teamId} inviteId={invite.id} />
				</div>
			))}
		</div>
	);
}
