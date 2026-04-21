import { PublicPageLoading } from "@/components/home/public-page-loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function RecruitingListingLoading() {
	return (
		<PublicPageLoading
			maxWidth="4xl"
			titleWidthClassName="w-56"
			descriptionWidthClassName="w-72"
			actionWidthClassName="w-28"
		>
			<Skeleton className="h-56 w-full" />
		</PublicPageLoading>
	);
}
