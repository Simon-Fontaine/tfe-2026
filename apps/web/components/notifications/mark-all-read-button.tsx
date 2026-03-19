"use client";

import { markAllNotificationsReadAction } from "@/app/dashboard/actions/notifications";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";

export function MarkAllReadButton() {
	const { submit, isPending } = useFormAction(markAllNotificationsReadAction, {
		successMessage: "All notifications marked as read",
	});

	function handleClick() {
		const fd = new FormData();
		submit(fd);
	}

	return (
		<Button size="sm" variant="outline" onClick={handleClick} disabled={isPending}>
			{isPending && <Spinner className="mr-1.5" />}
			Mark all as read
		</Button>
	);
}
