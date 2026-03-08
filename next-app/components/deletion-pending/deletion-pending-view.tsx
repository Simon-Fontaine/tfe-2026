"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { signOutAction } from "@/app/(auth)/auth/sign-out-actions";
import { cancelAccountDeletionAction } from "@/app/dashboard/settings/actions/account-deletion";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface DeletionPendingViewProps {
	scheduledAt: string;
}

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

export function DeletionPendingView({ scheduledAt }: DeletionPendingViewProps) {
	const router = useRouter();
	const [cancelling, startCancelling] = useTransition();
	const [signingOut, startSigningOut] = useTransition();

	function onCancel() {
		startCancelling(async () => {
			const result = await cancelAccountDeletionAction();
			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success("Account deletion cancelled.");
				router.push("/dashboard");
			}
		});
	}

	function onSignOut() {
		startSigningOut(async () => {
			await signOutAction();
		});
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col items-center gap-3 text-center">
				<div className="inline-flex size-12 items-center justify-center bg-destructive/10 text-destructive">
					<HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-6" />
				</div>
				<div className="space-y-1">
					<h1 className="text-sm font-semibold">Account deletion scheduled</h1>
					<p className="text-xs text-muted-foreground">
						Your account is scheduled for permanent deletion on{" "}
						<span className="font-medium text-foreground">{formatDate(scheduledAt)}</span>. You can
						cancel this before then.
					</p>
				</div>
			</div>

			<div className="space-y-2">
				<Button
					className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
					variant="outline"
					onClick={onCancel}
					disabled={cancelling || signingOut}
				>
					{cancelling && <Spinner className="mr-2" />}
					{cancelling ? "Cancelling…" : "Cancel deletion"}
				</Button>
				<Button
					className="w-full"
					variant="outline"
					onClick={onSignOut}
					disabled={cancelling || signingOut}
				>
					{signingOut && <Spinner className="mr-2" />}
					{signingOut ? "Signing out…" : "Sign out"}
				</Button>
			</div>
		</div>
	);
}
