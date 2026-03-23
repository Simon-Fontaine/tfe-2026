"use server";

import { apiGet } from "@/lib/api-client";

export interface PendingVerifications {
	emailChange: { pendingEmail: string } | null;
	passwordChange: boolean;
	twoFactorDisable: boolean;
	passkeyDisable: { credentialId: string; credentialName: string } | null;
	securityKeyDisable: { credentialId: string; credentialName: string } | null;
}

export async function getPendingVerificationsAction(): Promise<PendingVerifications> {
	const res = await apiGet<PendingVerifications>("/api/settings/verifications/pending");
	if ("data" in res) return res.data;
	return {
		emailChange: null,
		passwordChange: false,
		twoFactorDisable: false,
		passkeyDisable: null,
		securityKeyDisable: null,
	};
}
