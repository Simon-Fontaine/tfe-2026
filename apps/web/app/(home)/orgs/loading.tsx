import { PublicListLoading, PublicPageLoading } from "@/components/home/public-page-loading";

export default function OrgsLoading() {
	return (
		<PublicPageLoading titleWidthClassName="w-40" actionWidthClassName="w-40">
			<PublicListLoading itemCount={6} itemHeightClassName="h-16" />
		</PublicPageLoading>
	);
}
