"use client";

import { ComputerIcon } from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
	getActiveSessionsAction,
	revokeAllOtherSessionsAction,
	revokeSessionAction,
	type SessionInfo,
} from "@/app/dashboard/settings/actions/session";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { SessionListItem } from "./session-list-item";

export function ActiveSessionsSection() {
	const [sessions, setSessions] = useState<SessionInfo[]>([]);
	const [revoking, setRevoking] = useState(false);

	const refresh = useCallback(async () => {
		const list = await getActiveSessionsAction();
		setSessions(list);
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const handleRevoke = useCallback(
		async (id: string) => {
			setRevoking(true);
			const result = await revokeSessionAction(id);
			setRevoking(false);
			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success("Session revoked.");
				await refresh();
			}
		},
		[refresh]
	);

	const handleRevokeAll = useCallback(async () => {
		setRevoking(true);
		const result = await revokeAllOtherSessionsAction();
		setRevoking(false);
		if (result.error) {
			toast.error(result.error);
		} else {
			toast.success("All other sessions have been signed out.");
			await refresh();
		}
	}, [refresh]);

	const otherSessions = sessions.filter((s) => !s.isCurrent);

	return (
		<SettingsSectionCard
			icon={ComputerIcon}
			title="Active sessions"
			description="Devices currently signed in to your account"
			headerRight={
				otherSessions.length > 0 ? (
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant="outline" size="sm" className="text-destructive">
								Sign out all others
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Sign out all other sessions?</AlertDialogTitle>
								<AlertDialogDescription>
									This will immediately sign out {otherSessions.length} other{" "}
									{otherSessions.length === 1 ? "session" : "sessions"}. Your current session will
									not be affected.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction onClick={handleRevokeAll} disabled={revoking}>
									Sign out all
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				) : undefined
			}
		>
			{sessions.length === 0 ? (
				<EmptyStateBlock
					icon={ComputerIcon}
					title="No active sessions"
					description="Session information will appear here."
				/>
			) : (
				<div className="divide-y">
					{sessions.map((s) => (
						<SessionListItem key={s.id} session={s} onRevoke={handleRevoke} revoking={revoking} />
					))}
				</div>
			)}
		</SettingsSectionCard>
	);
}
