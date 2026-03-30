"use client";

import { Delete01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { deleteAvailabilityAction } from "@/app/dashboard/schedule/actions/availability";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";

export function DeleteButton({ id, teamId }: { id: string; teamId: string }) {
	const { formAction, submit, isPending } = useFormAction(deleteAvailabilityAction);

	return (
		<form
			action={formAction}
			onSubmit={(e) => {
				e.preventDefault();
				const fd = new FormData(e.currentTarget);
				fd.set("id", id);
				fd.set("teamId", teamId);
				submit(fd);
			}}
		>
			<input type="hidden" name="id" value={id} />
			<input type="hidden" name="teamId" value={teamId} />
			<Button
				type="submit"
				variant="ghost"
				size="icon"
				className="size-7 text-muted-foreground hover:text-destructive"
				disabled={isPending}
			>
				{isPending ? (
					<Spinner className="size-3" />
				) : (
					<HugeiconsIcon icon={Delete01Icon} strokeWidth={2} className="size-3.5" />
				)}
			</Button>
		</form>
	);
}
