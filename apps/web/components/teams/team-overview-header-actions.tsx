"use client";

import { MoreHorizontalIcon, Sword03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { DiscoveryTeam } from "@scrimflow/shared";
import Link from "next/link";
import { useState } from "react";
import { CreateScrimDialog } from "@/components/scrims/create-scrim-dialog";
import { InvitePlayerDialog } from "@/components/teams/invite-player-dialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateUpdatePostDialog } from "@/components/updates/create-update-post-dialog";
import { appRoutes } from "@/lib/routes";

interface TeamOverviewHeaderActionsProps {
	teamId: string;
	canManageAdmins: boolean;
	opponentOptions: DiscoveryTeam[];
}

export function TeamOverviewHeaderActions({
	teamId,
	canManageAdmins,
	opponentOptions,
}: TeamOverviewHeaderActionsProps) {
	const [inviteOpen, setInviteOpen] = useState(false);
	const [updateOpen, setUpdateOpen] = useState(false);

	return (
		<>
			<div className="flex items-center gap-2">
				{opponentOptions.length > 0 ? (
					<CreateScrimDialog teamId={teamId} opponentOptions={opponentOptions}>
						<Button size="sm">
							<HugeiconsIcon icon={Sword03Icon} strokeWidth={2} className="mr-1.5 size-4" />
							Schedule scrim
						</Button>
					</CreateScrimDialog>
				) : (
					<Button size="sm" disabled>
						<HugeiconsIcon icon={Sword03Icon} strokeWidth={2} className="mr-1.5 size-4" />
						Schedule scrim
					</Button>
				)}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button size="sm" variant="outline">
							<HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onSelect={() => setInviteOpen(true)}>Invite player</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => setUpdateOpen(true)}>Post update</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link href={appRoutes.teams.settings(teamId)} className="flex w-full items-center">
								Settings
							</Link>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<InvitePlayerDialog
				teamId={teamId}
				canManageAdmins={canManageAdmins}
				defaultMemberType="player"
				title="Invite player"
				open={inviteOpen}
				onOpenChange={setInviteOpen}
			/>
			<CreateUpdatePostDialog teamId={teamId} open={updateOpen} onOpenChange={setUpdateOpen} />
		</>
	);
}
