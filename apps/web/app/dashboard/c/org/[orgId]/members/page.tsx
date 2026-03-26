import { UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { notFound } from "next/navigation";

import { InviteMemberDialog } from "@/components/orgs/invite-member-dialog";
import { MemberActionsDropdown } from "@/components/orgs/member-actions-dropdown";
import { OrgPendingInvitesSection } from "@/components/orgs/org-pending-invites-section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth/session";
import { getOrgWithTeams } from "@/lib/data/orgs";

const ROLE_LABELS: Record<string, string> = {
	owner: "Owner",
	admin: "Admin",
	member: "Member",
};

export default async function OrgMembersPage({ params }: { params: Promise<{ orgId: string }> }) {
	const { user } = await getCurrentSession();
	if (!user) return null;

	const { orgId } = await params;
	const org = await getOrgWithTeams(orgId, user.id);
	if (!org) notFound();

	const canManage = org.currentUser.canManage;

	return (
		<>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-lg font-bold">Members</h1>
					<p className="text-xs text-muted-foreground">
						{org.members.length} member{org.members.length === 1 ? "" : "s"} in {org.name}
					</p>
				</div>
				{canManage && (
					<InviteMemberDialog orgId={org.id}>
						<Button size="sm">
							<HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} className="mr-1.5 size-4" />
							Invite member
						</Button>
					</InviteMemberDialog>
				)}
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Active members</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					{org.members.map((member) => (
						<div key={member.id} className="flex items-center gap-3 border px-3 py-3">
							<Avatar className="size-8 overflow-hidden rounded-none after:rounded-none">
								<AvatarImage src={member.avatarUrl ?? undefined} className="rounded-none" />
								<AvatarFallback className="rounded-none text-[10px] font-bold">
									{member.displayName.slice(0, 2).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<p className="truncate text-xs font-medium">{member.displayName}</p>
								<p className="text-[11px] text-muted-foreground">
									{member.memberType === "staff"
										? (member.staffRole ?? "staff")
										: (member.gameRole ?? "player")}
									{" · "}
									{member.activeTeamCount} active team
									{member.activeTeamCount === 1 ? "" : "s"}
								</p>
							</div>
							<Badge variant="secondary" className="text-[10px]">
								{ROLE_LABELS[member.role] ?? member.role}
							</Badge>
							{canManage && member.userId !== user.id && (
								<MemberActionsDropdown
									orgId={org.id}
									member={member}
									viewerRole={org.currentUser.role ?? "member"}
								/>
							)}
						</div>
					))}
				</CardContent>
			</Card>

			{org.pendingInvites.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Pending invites</CardTitle>
					</CardHeader>
					<CardContent>
						<OrgPendingInvitesSection orgId={org.id} invites={org.pendingInvites} />
					</CardContent>
				</Card>
			)}
		</>
	);
}
