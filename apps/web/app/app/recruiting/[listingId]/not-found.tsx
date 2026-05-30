import { Search01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/workspace/page-container";
import { appRoutes } from "@/lib/routes";

export default function ListingNotFound() {
	return (
		<PageContainer>
			<EmptyState
				icon={Search01Icon}
				title="Listing not found."
				action={
					<Link href={appRoutes.recruiting.root} className="text-sm underline">
						Browse listings
					</Link>
				}
			/>
		</PageContainer>
	);
}
