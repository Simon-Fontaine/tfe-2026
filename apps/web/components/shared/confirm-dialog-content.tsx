"use client";

import { Alert02Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import {
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogContentProps {
	title: string;
	children: ReactNode;
	confirmLabel: string;
	destructive?: boolean;
	onConfirm: () => void;
	pending?: boolean;
}

export function ConfirmDialogContent({
	title,
	children,
	confirmLabel,
	destructive = true,
	onConfirm,
	pending,
}: ConfirmDialogContentProps) {
	return (
		<>
			<AlertDialogHeader>
				<div className="flex items-start gap-3">
					<HugeiconsIcon
						icon={Alert02Icon}
						strokeWidth={2}
						className="mt-0.5 size-5 shrink-0 text-destructive"
					/>
					<div>
						<AlertDialogTitle>{title}</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div>{children}</div>
						</AlertDialogDescription>
					</div>
				</div>
			</AlertDialogHeader>
			<AlertDialogFooter>
				<AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
				<AlertDialogAction
					onClick={onConfirm}
					disabled={pending}
					className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : ""}
				>
					{pending && (
						<HugeiconsIcon
							icon={Loading03Icon}
							strokeWidth={2}
							className="mr-2 size-4 animate-spin"
						/>
					)}
					{confirmLabel}
				</AlertDialogAction>
			</AlertDialogFooter>
		</>
	);
}
