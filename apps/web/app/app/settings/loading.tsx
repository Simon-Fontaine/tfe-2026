import { PageContainer } from "@/components/workspace/page-container";

export default function SettingsLoading() {
	return (
		<PageContainer>
			{/* Tab nav placeholder */}
			<div className="mb-6 flex gap-4 border-b pb-3">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="h-4 w-20 bg-muted animate-pulse" />
				))}
			</div>
			{/* Page header skeleton */}
			<div className="mb-8 h-7 w-28 bg-muted animate-pulse" />
			{/* Section skeletons */}
			<div className="space-y-6">
				<div className="h-20 w-full bg-muted animate-pulse" />
				<div className="h-px w-full bg-muted" />
				<div className="h-20 w-full bg-muted animate-pulse" />
				<div className="h-px w-full bg-muted" />
				<div className="h-20 w-full bg-muted animate-pulse" />
			</div>
		</PageContainer>
	);
}
