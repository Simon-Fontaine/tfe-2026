"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cancelOrgInviteAction, resendOrgInviteAction } from "@/app/actions/org";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function ManageInviteDropdown({ orgId, inviteId }: { orgId: string; inviteId: string }) {
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
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button size="icon-sm" variant="ghost" aria-label="Invite actions" disabled={isPending}>
					{isPending ? <Spinner /> : <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={submitResend} disabled={isPending}>
					Resend
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={submitCancel}
					disabled={isPending}
					className="text-destructive focus:text-destructive"
				>
					Cancel
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function OrgPendingInvitesSection({ orgId, invites }: OrgPendingInvitesSectionProps) {
	if (invites.length === 0) {
		return (
			<div className="py-8 text-center text-sm text-muted-foreground">No pending invites.</div>
		);
	}

	return (
		<div className="overflow-hidden border">
			<div className="grid grid-cols-[minmax(13rem,1.5fr)_repeat(3,minmax(6rem,1fr))_3rem] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
				<span>Invitee</span>
				<span>Permission</span>
				<span>Type</span>
				<span>Expiry</span>
				<span className="text-right">Actions</span>
			</div>
			<div className="divide-y">
				{invites.map((invite) => (
					<div
						key={invite.id}
						className="grid grid-cols-[minmax(13rem,1.5fr)_repeat(3,minmax(6rem,1fr))_3rem] gap-3 px-4 py-3 text-sm"
					>
						<div className="flex min-w-0 items-center gap-3">
							<Avatar className="size-8 shrink-0 overflow-hidden rounded-none after:rounded-none">
								<AvatarImage src={invite.inviteeAvatarUrl ?? undefined} className="rounded-none" />
								<AvatarFallback className="rounded-none text-[10px] font-bold">
									{invite.inviteeDisplayName.slice(0, 2).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0">
								<p className="truncate font-medium">{invite.inviteeDisplayName}</p>
							</div>
						</div>
						<span>
							<Badge variant="outline">{ROLE_LABELS[invite.role] ?? invite.role}</Badge>
						</span>
						<span className="capitalize">
							<Badge variant="outline">
								{invite.memberType === "staff"
									? (invite.staffRole ?? "staff")
									: (invite.gameRole ?? "player")}
							</Badge>
						</span>
						<span>{formatExpiry(invite.expiresAt)}</span>
						<div className="flex justify-end">
							<ManageInviteDropdown orgId={orgId} inviteId={invite.id} />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
