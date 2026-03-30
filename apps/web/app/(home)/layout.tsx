import type { ReactNode } from "react";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteHeaderWrapper } from "@/components/home/site-header-wrapper";

export default function HomeLayout({ children }: { children: ReactNode }) {
	return (
		<div>
			<SiteHeaderWrapper />
			<main id="main-content">{children}</main>
			<SiteFooter />
		</div>
	);
}
