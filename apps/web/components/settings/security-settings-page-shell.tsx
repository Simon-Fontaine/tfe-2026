import type { ReactNode } from "react";

interface SecuritySettingsPageShellProps {
	children: ReactNode;
}

export function SecuritySettingsPageShell({ children }: SecuritySettingsPageShellProps) {
	return <div className="space-y-6">{children}</div>;
}
