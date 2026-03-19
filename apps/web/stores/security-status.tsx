"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

interface SecurityStatusContextValue {
	hasTOTP: boolean;
	passkeyCount: number;
	securityKeyCount: number;
	setHasTOTP: (v: boolean) => void;
	setPasskeyCount: (v: number) => void;
	setSecurityKeyCount: (v: number) => void;
}

const SecurityStatusContext = createContext<SecurityStatusContextValue | null>(null);

export function SecurityStatusProvider({
	initialHasTOTP,
	initialPasskeyCount,
	initialSecurityKeyCount,
	children,
}: {
	initialHasTOTP: boolean;
	initialPasskeyCount: number;
	initialSecurityKeyCount: number;
	children: ReactNode;
}) {
	const [hasTOTP, setHasTOTP] = useState(initialHasTOTP);
	const [passkeyCount, setPasskeyCount] = useState(initialPasskeyCount);
	const [securityKeyCount, setSecurityKeyCount] = useState(initialSecurityKeyCount);

	return (
		<SecurityStatusContext.Provider
			value={{
				hasTOTP,
				passkeyCount,
				securityKeyCount,
				setHasTOTP,
				setPasskeyCount,
				setSecurityKeyCount,
			}}
		>
			{children}
		</SecurityStatusContext.Provider>
	);
}

export function useSecurityStatus() {
	const ctx = useContext(SecurityStatusContext);
	if (!ctx) throw new Error("useSecurityStatus must be used within SecurityStatusProvider");
	return ctx;
}
