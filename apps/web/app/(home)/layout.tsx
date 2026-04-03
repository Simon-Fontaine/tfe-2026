import type { ReactNode } from "react";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteHeaderWrapper } from "@/components/home/site-header-wrapper";

export default function HomeLayout({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-dvh flex-col">
			<SiteHeaderWrapper />
			<main id="main-content" className="flex-1">
				{children}
			</main>
			<SiteFooter />
		</div>
	);
}
