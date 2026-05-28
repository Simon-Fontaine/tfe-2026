"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { ReportDialog } from "@/components/reports/report-dialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ReportListingActionsProps {
	listingId: string;
	listingTitle: string;
}

export function ReportListingActions({ listingId, listingTitle }: ReportListingActionsProps) {
	const [reportOpen, setReportOpen] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button size="sm" variant="ghost" aria-label="More actions">
						<HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={() => setReportOpen(true)}>Report listing</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<ReportDialog
				open={reportOpen}
				onOpenChange={setReportOpen}
				targetType="listing"
				targetId={listingId}
				targetDisplayName={listingTitle}
			/>
		</>
	);
}
