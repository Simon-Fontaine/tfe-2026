"use client";

import {
	ArrowRight01Icon,
	Clock01Icon,
	FingerPrintIcon,
	Key01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import { Badge } from "@/components/ui/badge";
import { useSecurityStatus } from "@/stores/security-status";

const methods = [
	{ key: "totp", label: "Authenticator app (TOTP)", icon: Clock01Icon, anchor: "#totp" },
	{ key: "passkeys", label: "Passkeys", icon: FingerPrintIcon, anchor: "#passkeys" },
	{ key: "security-keys", label: "Security keys", icon: Key01Icon, anchor: "#security-keys" },
] as const;

export function TwoFactorMethodsSection() {
	const { hasTOTP, passkeyCount, securityKeyCount } = useSecurityStatus();
	const enabledCount =
		(hasTOTP ? 1 : 0) + (passkeyCount > 0 ? 1 : 0) + (securityKeyCount > 0 ? 1 : 0);

	function getStatus(key: string): boolean {
		if (key === "totp") return hasTOTP;
		if (key === "passkeys") return passkeyCount > 0;
		if (key === "security-keys") return securityKeyCount > 0;
		return false;
	}

	return (
		<SettingsSectionCard
			title="Two-factor authentication"
			description="Add extra security to your account"
			headerRight={
				enabledCount > 0 ? (
					<Badge variant="secondary">{enabledCount} enabled</Badge>
				) : (
					<Badge variant="destructive">None enabled</Badge>
				)
			}
		>
			<div className="divide-y">
				{methods.map((m) => {
					const enabled = getStatus(m.key);
					return (
						<Link
							key={m.key}
							href={m.anchor}
							className="flex items-center gap-3 px-1 py-3 text-xs transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
						>
							<HugeiconsIcon
								icon={m.icon}
								strokeWidth={2}
								className="size-4 text-muted-foreground"
							/>
							<span className="flex-1">{m.label}</span>
							<Badge
								variant={enabled ? "default" : "outline"}
								className="w-16 justify-center text-xs"
							>
								{enabled ? "Enabled" : "Disabled"}
							</Badge>
							<HugeiconsIcon
								icon={ArrowRight01Icon}
								strokeWidth={2}
								className="size-4 text-muted-foreground"
							/>
						</Link>
					);
				})}
			</div>
		</SettingsSectionCard>
	);
}
