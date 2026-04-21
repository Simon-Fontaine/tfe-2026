import { PublicPageLoading } from "@/components/home/public-page-loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrgProfileLoading() {
	return (
		<PublicPageLoading maxWidth="5xl" titleWidthClassName="w-48" descriptionWidthClassName="w-64">
			<Skeleton className="h-36 w-full" />
			<Skeleton className="h-28 w-full" />
			<Skeleton className="h-40 w-full" />
		</PublicPageLoading>
	);
}
