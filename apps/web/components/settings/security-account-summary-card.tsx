"use client";

import {
	Clock01Icon,
	FingerPrintIcon,
	Key01Icon,
	LockIcon,
	Mail01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { SecurityStatusPill } from "@/components/shared/security-status-pill";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useSecurityStatus } from "@/stores/security-status";

interface SecurityAccountSummaryCardProps {
	email: string;
	hasPassword: boolean;
}

function SummaryItem({
	icon,
	label,
	value,
}: {
	icon: IconSvgElement;
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-center gap-2">
			<HugeiconsIcon icon={icon} strokeWidth={2} className="size-4 text-muted-foreground" />
			<span className="text-xs text-muted-foreground">{label}</span>
			<span className="ml-auto text-xs font-medium">{value}</span>
		</div>
	);
}

export function SecurityAccountSummaryCard({
	email,
	hasPassword,
}: SecurityAccountSummaryCardProps) {
	const { hasTOTP, passkeyCount, securityKeyCount } = useSecurityStatus();
	const has2FA = hasTOTP || passkeyCount > 0 || securityKeyCount > 0;
	const methodCount =
		(hasTOTP ? 1 : 0) + (passkeyCount > 0 ? 1 : 0) + (securityKeyCount > 0 ? 1 : 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Account overview</CardTitle>
				<CardAction>
					<SecurityStatusPill
						level={has2FA ? "secure" : hasPassword ? "partial" : "at-risk"}
						label={has2FA ? "Protected" : hasPassword ? "Basic" : "At risk"}
					/>
				</CardAction>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="size-4 shrink-0" />
					<span>{email}</span>
				</div>
				<Separator />
				<div className="grid gap-2 sm:grid-cols-2">
					<SummaryItem icon={LockIcon} label="Password" value={hasPassword ? "Set" : "Not set"} />
					<SummaryItem icon={Clock01Icon} label="TOTP" value={hasTOTP ? "Enabled" : "Disabled"} />
					<SummaryItem icon={FingerPrintIcon} label="Passkeys" value={String(passkeyCount)} />
					<SummaryItem icon={Key01Icon} label="Security keys" value={String(securityKeyCount)} />
				</div>
				{has2FA && (
					<p className="text-xs text-muted-foreground">
						{methodCount} two-factor {methodCount === 1 ? "method" : "methods"} enabled
					</p>
				)}
			</CardContent>
		</Card>
	);
}
