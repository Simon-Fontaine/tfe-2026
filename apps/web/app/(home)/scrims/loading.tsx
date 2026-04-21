import { PublicListLoading, PublicPageLoading } from "@/components/home/public-page-loading";

export default function ScrimsLoading() {
	return (
		<PublicPageLoading
			titleWidthClassName="w-24"
			descriptionWidthClassName="w-80"
			actionWidthClassName="w-48"
		>
			<PublicListLoading />
		</PublicPageLoading>
	);
}
