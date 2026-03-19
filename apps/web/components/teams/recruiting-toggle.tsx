"use client";

import { toggleRecruitingAction } from "@/app/dashboard/teams/actions/team";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";
import { cn } from "@/lib/utils";

interface RecruitingToggleProps {
	orgId: string;
	teamId: string;
	isRecruiting: boolean;
}

export function RecruitingToggle({ orgId, teamId, isRecruiting }: RecruitingToggleProps) {
	const { submit, isPending } = useFormAction(toggleRecruitingAction, {
		successMessage: isRecruiting ? "Recruiting disabled" : "Recruiting enabled",
	});

	function handleToggle() {
		const fd = new FormData();
		fd.set("orgId", orgId);
		fd.set("teamId", teamId);
		submit(fd);
	}

	return (
		<div className="flex items-center gap-3">
			<span className="text-xs text-muted-foreground">Recruiting</span>
			<button
				type="button"
				role="switch"
				aria-checked={isRecruiting}
				onClick={handleToggle}
				disabled={isPending}
				className={cn(
					"relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
					isRecruiting ? "bg-primary" : "bg-muted-foreground/30"
				)}
			>
				<span
					className={cn(
						"pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
						isRecruiting ? "translate-x-4" : "translate-x-0"
					)}
				/>
			</button>
			{isPending && <Spinner className="size-3" />}
			{isRecruiting && <span className="text-xs font-medium text-green-600">Active</span>}
		</div>
	);
}
