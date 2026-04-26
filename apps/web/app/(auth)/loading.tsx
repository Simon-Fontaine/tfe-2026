import { AuthShellLayout } from "@/components/auth/auth-shell-layout";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
	return (
		<AuthShellLayout>
			<div className="space-y-4" aria-hidden="true">
				{/* Row 1: icon square + title/subtitle stubs */}
				<div className="flex items-center gap-3">
					<Skeleton className="h-8 w-8 rounded-md" />
					<div className="space-y-1">
						<Skeleton className="h-3 w-32" />
						<Skeleton className="h-2 w-48" />
					</div>
				</div>
				{/* Rows 2–5: label+input, label+input, submit button, footer link */}
				<div className="space-y-3">
					<div className="space-y-1.5">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-10 w-full" />
					</div>
					<div className="space-y-1.5">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-10 w-full" />
					</div>
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-3 w-full" />
				</div>
			</div>
		</AuthShellLayout>
	);
}
