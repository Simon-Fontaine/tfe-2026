import { Alert02Icon, ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";

export default function NotFound() {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center px-4">
			<div className="w-full max-w-md text-center">
				<div className="mx-auto mb-6 flex size-12 items-center justify-center border bg-primary/10">
					<HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-6 text-primary" />
				</div>

				<p className="text-sm font-bold tracking-widest text-primary">404</p>
				<h1 className="mt-2 text-lg font-bold">Page not found</h1>
				<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
					The page you're looking for doesn't exist or has been moved.
				</p>

				<div className="mt-6 flex items-center justify-center gap-2">
					<Button asChild>
						<Link href="/">
							<HugeiconsIcon
								icon={ArrowLeft01Icon}
								strokeWidth={2}
								data-icon="inline-start"
								className="size-3.5"
							/>
							Back to home
						</Link>
					</Button>
				</div>

				<p className="mt-8 text-xs text-muted-foreground">
					&copy; {new Date().getFullYear()} {siteConfig.footer.copyright}
				</p>
			</div>
		</div>
	);
}
