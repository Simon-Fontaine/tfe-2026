import { PublicListLoading, PublicPageLoading } from "@/components/home/public-page-loading";

export default function ScrimsLoading() {
	return (
		<PublicPageLoading titleWidthClassName="w-24" actionWidthClassName="w-48">
			<PublicListLoading itemCount={5} itemHeightClassName="h-12" />
		</PublicPageLoading>
	);
}
