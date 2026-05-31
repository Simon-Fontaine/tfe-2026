import { PublicPageLoading } from "@/components/home/public-page-loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function RecruitingListingLoading() {
	return (
		<PublicPageLoading maxWidth="4xl" titleWidthClassName="w-56">
			<div className="grid gap-6 sm:grid-cols-3">
				<Skeleton className="col-span-2 h-56" />
				<Skeleton className="h-40" />
			</div>
		</PublicPageLoading>
	);
}
