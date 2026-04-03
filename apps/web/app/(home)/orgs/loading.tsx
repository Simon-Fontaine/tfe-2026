import { PublicGridLoading, PublicPageLoading } from "@/components/home/public-page-loading";

export default function OrgsLoading() {
	return (
		<PublicPageLoading titleWidthClassName="w-40" descriptionWidthClassName="w-72">
			<PublicGridLoading />
		</PublicPageLoading>
	);
}
