"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { CodeDisplay } from "@/components/shared/code-display";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface RecoveryCodeDialogProps {
	recoveryCode: string | null;
	onConfirm: () => void;
}

export function RecoveryCodeDialog({ recoveryCode, onConfirm }: RecoveryCodeDialogProps) {
	const [confirmed, setConfirmed] = useState(false);

	return (
		<Dialog
			open={!!recoveryCode}
			onOpenChange={(open) => {
				if (!open && confirmed) {
					setConfirmed(false);
					onConfirm();
				}
			}}
		>
			<DialogContent
				showCloseButton={false}
				onInteractOutside={(e) => e.preventDefault()}
				onEscapeKeyDown={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-5 text-amber-600" />
						Save your recovery code
					</DialogTitle>
					<DialogDescription>
						This is the only time your recovery code will be shown. If you lose access to your
						two-factor methods, you can use this code to regain access to your account.
					</DialogDescription>
				</DialogHeader>

				{recoveryCode && <CodeDisplay value={recoveryCode} />}

				<label className="flex cursor-pointer items-center gap-2 text-xs select-none">
					<input
						type="checkbox"
						checked={confirmed}
						onChange={(e) => setConfirmed(e.target.checked)}
						className="size-4 rounded border-border accent-primary"
					/>
					I have saved my recovery code somewhere safe
				</label>

				<DialogFooter>
					<Button
						disabled={!confirmed}
						onClick={() => {
							setConfirmed(false);
							onConfirm();
						}}
					>
						I&apos;ve saved my code
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
