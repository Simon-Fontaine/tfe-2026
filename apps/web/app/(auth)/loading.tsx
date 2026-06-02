import { AuthShellLayout } from "@/components/auth/auth-shell-layout";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
	return (
		<AuthShellLayout>
			<div className="space-y-4" role="status" aria-busy="true">
				<span className="sr-only">Loading</span>
				<div className="flex items-center gap-3">
					<Skeleton className="h-8 w-8" />
					<div className="space-y-1.5">
						<Skeleton className="h-3 w-28" />
						<Skeleton className="h-2 w-40" />
					</div>
				</div>

				<div className="space-y-2.5">
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-4/5" />
					<Skeleton className="h-10 w-full" />
					<div className="flex justify-center pt-1">
						<Skeleton className="h-3 w-28" />
					</div>
				</div>
			</div>
		</AuthShellLayout>
	);
}
