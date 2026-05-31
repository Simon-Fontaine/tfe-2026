import { PublicListLoading, PublicPageLoading } from "@/components/home/public-page-loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamsLoading() {
	return (
		<PublicPageLoading titleWidthClassName="w-24">
			<div className="flex flex-wrap gap-2">
				<Skeleton className="h-7 w-20" />
				<Skeleton className="h-7 w-24" />
			</div>
			<PublicListLoading itemCount={6} itemHeightClassName="h-16" />
		</PublicPageLoading>
	);
}
