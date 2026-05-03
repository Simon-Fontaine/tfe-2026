"use client";

import { useEffect, useRef, useState } from "react";
import { deleteOrgAction } from "@/app/actions/org";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";

interface DeleteOrgDialogProps {
	orgId: string;
	orgName: string;
	children: React.ReactNode;
}

export function DeleteOrgDialog({ orgId, orgName, children }: DeleteOrgDialogProps) {
	const [open, setOpen] = useState(false);
	const [confirmName, setConfirmName] = useState("");
	const pendingRef = useRef(false);

	const { state, submit, isPending } = useFormAction(deleteOrgAction, {
		loadingMessage: "Deleting organization…",
	});

	useEffect(() => {
		if (state?.success && pendingRef.current) {
			pendingRef.current = false;
			setOpen(false);
		}
	}, [state]);

	function handleDelete() {
		if (confirmName !== orgName) return;
		pendingRef.current = true;
		const fd = new FormData();
		fd.set("orgId", orgId);
		fd.set("confirmName", confirmName);
		submit(fd);
	}

	return (
		<AlertDialog
			open={open}
			onOpenChange={(o) => {
				setOpen(o);
				if (!o) setConfirmName("");
			}}
		>
			<AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete organization</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently delete <strong>{orgName}</strong> and all its teams. This action
						cannot be undone. Type the organization name below to confirm.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<Input
					value={confirmName}
					onChange={(e) => setConfirmName(e.target.value)}
					placeholder={orgName}
					className="mt-2"
				/>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={confirmName !== orgName || isPending}
					>
						{isPending && <Spinner className="mr-1.5" />}
						Delete organization
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
