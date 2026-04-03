import { PublicListLoading, PublicPageLoading } from "@/components/home/public-page-loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function PostsLoading() {
	return (
		<PublicPageLoading
			titleWidthClassName="w-44"
			descriptionWidthClassName="w-[30rem]"
			actionWidthClassName="w-44"
		>
			<div className="flex flex-wrap gap-2">
				<Skeleton className="h-6 w-20" />
				<Skeleton className="h-6 w-16" />
				<Skeleton className="h-6 w-16" />
				<Skeleton className="h-6 w-16" />
				<Skeleton className="h-6 w-16" />
			</div>
			<PublicListLoading itemHeightClassName="h-44" />
		</PublicPageLoading>
	);
}
