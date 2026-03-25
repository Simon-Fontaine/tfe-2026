"use client";

import {
	cancelOrgInviteAction,
	resendOrgInviteAction,
} from "@/app/dashboard/workspace/orgs/actions/org";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import type { OrgPendingInvite } from "@/lib/data/organization";

interface OrgPendingInvitesSectionProps {
	orgId: string;
	invites: OrgPendingInvite[];
}

const ROLE_LABELS: Record<string, string> = {
	owner: "Owner",
	admin: "Admin",
	member: "Member",
};

function formatExpiry(iso: string): string {
	const date = new Date(iso);
	const ms = date.getTime() - Date.now();
	if (ms <= 0) return "Expired";
	const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
	return days <= 1 ? "Expires soon" : `Expires in ${days}d`;
}

function ManageInviteButtons({ orgId, inviteId }: { orgId: string; inviteId: string }) {
	const cancelForm = useFormAction(cancelOrgInviteAction, { successMessage: "Invite cancelled" });
	const resendForm = useFormAction(resendOrgInviteAction, { successMessage: "Invite resent" });

	const isPending = cancelForm.isPending || resendForm.isPending;

	function submitCancel() {
		const fd = new FormData();
		fd.set("orgId", orgId);
		fd.set("inviteId", inviteId);
		cancelForm.submit(fd);
	}

	function submitResend() {
		const fd = new FormData();
		fd.set("orgId", orgId);
		fd.set("inviteId", inviteId);
		resendForm.submit(fd);
	}

	return (
		<div className="flex shrink-0 gap-2">
			<Button size="sm" variant="outline" onClick={submitResend} disabled={isPending}>
				{resendForm.isPending && <Spinner className="mr-1.5" />}
				Resend
			</Button>
			<Button size="sm" variant="outline" onClick={submitCancel} disabled={isPending}>
				{cancelForm.isPending && <Spinner className="mr-1.5" />}
				Cancel
			</Button>
		</div>
	);
}

export function OrgPendingInvitesSection({ orgId, invites }: OrgPendingInvitesSectionProps) {
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
								{ROLE_LABELS[invite.role] ?? invite.role}
							</Badge>
							<Badge variant="secondary" className="text-[10px] capitalize">
								{invite.memberType === "staff"
									? (invite.staffRole ?? "staff")
									: (invite.gameRole ?? "player")}
							</Badge>
							<span className="text-[10px] text-muted-foreground">
								{formatExpiry(invite.expiresAt)}
							</span>
						</div>
					</div>
					<ManageInviteButtons orgId={orgId} inviteId={invite.id} />
				</div>
			))}
		</div>
	);
}
