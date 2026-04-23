import { OnboardingShellLayout } from "@/components/onboarding/onboarding-shell-layout";
import { Skeleton } from "@/components/ui/skeleton";

export default function OnboardingLoading() {
	return (
		<OnboardingShellLayout>
			<div className="space-y-4" aria-hidden="true">
				<div className="space-y-2">
					<Skeleton className="h-7 w-40" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-3/4" />
				</div>
				<div className="space-y-3">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-32" />
				</div>
			</div>
		</OnboardingShellLayout>
	);
}
