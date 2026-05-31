"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { moderationCaseAction } from "@/app/actions/moderation";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { appRoutes } from "@/lib/routes";

interface QueueRowActionsDropdownProps {
	reportId: string;
	userId: string;
}

export function QueueRowActionsDropdown({ reportId, userId }: QueueRowActionsDropdownProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	function handleAssignToMe() {
		startTransition(async () => {
			await moderationCaseAction(reportId, { action: "assign" });
			router.refresh();
		});
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button size="icon" variant="ghost" className="size-8">
					<HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={handleAssignToMe} disabled={isPending}>
					Assign to me
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link href={appRoutes.moderation.report(reportId)}>View Report</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
