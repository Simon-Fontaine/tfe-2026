import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "./page-container";

interface PageSkeletonProps {
	/** Show a title + description skeleton header */
	header?: boolean;
	/** Number of stat card skeletons to show */
	statsGrid?: number;
	/** Number of content card skeletons */
	contentCards?: number;
	/** Layout variant */
	variant?: "default" | "table" | "grid" | "form";
}

export function PageSkeleton({
	header = true,
	statsGrid,
	contentCards = 1,
	variant = "default",
}: PageSkeletonProps) {
	return (
		<div role="status" aria-busy="true">
			<span className="sr-only">Loading</span>
			<PageContainer>
				{header && (
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-2">
							<Skeleton className="h-7 w-40" />
							<Skeleton className="h-4 w-64" />
						</div>
						<Skeleton className="h-9 w-28" />
					</div>
				)}

				{statsGrid && (
					<div
						className={`grid gap-3 ${statsGrid === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}
					>
						{Array.from({ length: statsGrid }, (_, i) => `stat-skel-${i}`).map((key) => (
							<Skeleton key={key} className="h-[76px]" />
						))}
					</div>
				)}

				{variant === "table" && (
					<div className="space-y-2">
						<Skeleton className="h-10 w-full" />
						{Array.from({ length: 5 }, (_, i) => `row-skel-${i}`).map((key) => (
							<Skeleton key={key} className="h-14 w-full" />
						))}
					</div>
				)}

				{variant === "grid" && (
					<div className="grid gap-3 sm:grid-cols-2">
						{Array.from({ length: contentCards }, (_, i) => `card-skel-${i}`).map((key) => (
							<Skeleton key={key} className="h-40" />
						))}
					</div>
				)}

				{variant === "form" && (
					<div className="space-y-6">
						{Array.from({ length: contentCards }, (_, i) => `form-skel-${i}`).map((key) => (
							<div key={key} className="space-y-3">
								<Skeleton className="h-5 w-32" />
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-2/3" />
							</div>
						))}
					</div>
				)}

				{variant === "default" &&
					Array.from({ length: contentCards }, (_, i) => `default-skel-${i}`).map((key) => (
						<Skeleton key={key} className="h-48" />
					))}
			</PageContainer>
		</div>
	);
}
