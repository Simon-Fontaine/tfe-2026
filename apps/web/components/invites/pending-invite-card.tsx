"use client";

import { canRespondToInvite } from "@scrimflow/shared";
import { respondToOrgInviteAction } from "@/app/dashboard/workspace/orgs/actions/org";
import { respondToTeamInviteAction } from "@/app/dashboard/workspace/orgs/actions/team";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import type { OrgInviteSummary } from "@/lib/data/organization";
import type { TeamInviteSummary } from "@/lib/data/team";

type PendingInviteCardProps =
	| { type: "team"; invite: TeamInviteSummary }
	| { type: "org"; invite: OrgInviteSummary };

const ROLE_LABELS: Record<string, string> = {
	tank: "Tank",
	damage: "DPS",
	support: "Support",
	owner: "Owner",
	admin: "Admin",
	member: "Member",
	staff: "Staff",
};

const STATUS_LABELS: Record<string, string> = {
	pending: "Pending",
	accepted: "Accepted",
	declined: "Declined",
	expired: "Expired",
	cancelled: "Cancelled",
};

function formatExpiry(iso: string): string {
	const date = new Date(iso);
	const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
	return days <= 0 ? "Expired" : days <= 1 ? "Expires soon" : `Expires in ${days}d`;
}

export function PendingInviteCard(props: PendingInviteCardProps) {
	const teamForm = useFormAction(respondToTeamInviteAction, {
		loadingMessage: "Processing…",
		successMessage: "Invite response sent",
	});
	const orgForm = useFormAction(respondToOrgInviteAction, {
		loadingMessage: "Processing…",
		successMessage: "Invite response sent",
	});

	const { submit, isPending } = props.type === "team" ? teamForm : orgForm;

	function respond(action: "accept" | "decline") {
		const fd = new FormData();
		fd.set("inviteId", props.invite.id);
		fd.set("action", action);
		submit(fd);
	}

	const name = props.type === "team" ? props.invite.teamName : props.invite.orgName;
	const avatarUrl = props.type === "team" ? props.invite.teamAvatarUrl : props.invite.orgAvatarUrl;
	const tag = props.type === "team" ? props.invite.teamTag : null;
	const role =
		props.type === "team"
			? (props.invite.roleInTeam ?? props.invite.staffRole ?? props.invite.memberType)
			: props.invite.role;
	const permissionRole = props.type === "team" ? props.invite.permissionRole : null;
	const canRespond = canRespondToInvite(props.invite.status, props.invite.expiresAt);

	return (
		<div className="flex items-center gap-3 border p-4">
			<Avatar className="size-10 shrink-0 overflow-hidden rounded-none after:rounded-none">
				<AvatarImage src={avatarUrl ?? undefined} className="rounded-none" />
				<AvatarFallback className="rounded-none font-mono text-xs font-bold">
					{tag ?? name.slice(0, 2).toUpperCase()}
				</AvatarFallback>
			</Avatar>

			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<p className="truncate text-sm font-semibold">{tag ? `[${tag}] ${name}` : name}</p>
					<Badge variant="outline" className="shrink-0 text-[10px]">
						{ROLE_LABELS[role] ?? role}
					</Badge>
					{permissionRole === "admin" && (
						<Badge variant="secondary" className="shrink-0 text-[10px]">
							Admin access
						</Badge>
					)}
					<Badge variant="secondary" className="shrink-0 text-[10px]">
						{STATUS_LABELS[props.invite.status] ?? props.invite.status}
					</Badge>
				</div>
				<p className="mt-0.5 text-xs text-muted-foreground">
					Invited by {props.invite.inviterDisplayName} · {formatExpiry(props.invite.expiresAt)}
				</p>
			</div>

			{canRespond ? (
				<div className="flex shrink-0 gap-2">
					<Button size="sm" onClick={() => respond("accept")} disabled={isPending}>
						{isPending && <Spinner className="mr-1.5" />}
						Accept
					</Button>
					<Button
						size="sm"
						variant="outline"
						onClick={() => respond("decline")}
						disabled={isPending}
					>
						Decline
					</Button>
				</div>
			) : (
				<span className="text-xs text-muted-foreground">No action</span>
			)}
		</div>
	);
}
