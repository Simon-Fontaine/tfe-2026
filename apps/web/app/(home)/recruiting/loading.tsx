import { PublicListLoading, PublicPageLoading } from "@/components/home/public-page-loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function RecruitingLoading() {
	return (
		<PublicPageLoading
			titleWidthClassName="w-32"
			descriptionWidthClassName="w-96"
			actionWidthClassName="w-44"
		>
			<div className="flex flex-wrap gap-2">
				<Skeleton className="h-7 w-20" />
				<Skeleton className="h-7 w-16" />
				<Skeleton className="h-7 w-16" />
				<Skeleton className="h-7 w-16" />
				<Skeleton className="h-7 w-16" />
			</div>
			<PublicListLoading />
		</PublicPageLoading>
	);
}
