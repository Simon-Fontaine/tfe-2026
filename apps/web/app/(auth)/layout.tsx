import type { ReactNode } from "react";
import { AuthShellLayout } from "@/components/auth/auth-shell-layout";

export default function AuthLayout({ children }: { children: ReactNode }) {
	return <AuthShellLayout>{children}</AuthShellLayout>;
}
