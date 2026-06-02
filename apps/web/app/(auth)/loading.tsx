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
						<Skeleton className="h-3 w-32" />
					</div>
				</div>

				<div className="space-y-3">
					<div className="space-y-1.5">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-10 w-full" />
					</div>
					<div className="space-y-1.5">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-10 w-full" />
					</div>
					<div className="flex justify-end">
						<Skeleton className="h-3 w-24" />
					</div>
					<Skeleton className="h-10 w-full" />
					<div className="py-1.5">
						<Skeleton className="h-px w-full" />
					</div>
					<Skeleton className="h-10 w-full" />
				</div>
			</div>
		</AuthShellLayout>
	);
}
