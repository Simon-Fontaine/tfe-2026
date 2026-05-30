import { PageContainer } from "@/components/workspace/page-container";

export default function ProfileLoading() {
	return (
		<PageContainer>
			<div className="space-y-2">
				<div className="h-7 w-32 bg-muted animate-pulse" />
				<div className="h-4 w-56 bg-muted animate-pulse" />
			</div>
			<div className="h-40 w-full bg-muted animate-pulse" />
			<div className="h-40 w-full bg-muted animate-pulse" />
			<div className="h-96 w-full bg-muted animate-pulse" />
		</PageContainer>
	);
}
