"use client";

import { markAllNotificationsReadAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";

interface MarkAllReadButtonProps {
	onClick?: () => Promise<void> | void;
	isPending?: boolean;
}

export function MarkAllReadButton({ onClick, isPending: externalPending }: MarkAllReadButtonProps) {
	const { submit, isPending } = useFormAction(markAllNotificationsReadAction, {
		successMessage: "All notifications marked as read",
	});
	const isBusy = externalPending ?? (!onClick && isPending);

	function handleClick() {
		if (onClick) {
			void onClick();
			return;
		}

		const fd = new FormData();
		submit(fd);
	}

	return (
		<Button size="sm" variant="outline" onClick={handleClick} disabled={isBusy}>
			{isBusy && <Spinner className="mr-1.5" />}
			Mark all as read
		</Button>
	);
}
