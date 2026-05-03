import Link from "next/link";

type PublicRelatedRouteCard = {
	label: string;
	href: string;
	description: string;
};

interface PublicRelatedRouteCardsProps {
	cards: PublicRelatedRouteCard[];
}

export function PublicRelatedRouteCards({ cards }: PublicRelatedRouteCardsProps) {
	return (
		<div className="grid gap-3 md:grid-cols-3">
			{cards.map((card) => (
				<Link
					key={card.href}
					href={card.href}
					className="border p-4 transition-colors hover:bg-muted/50"
				>
					<p className="text-sm font-semibold">{card.label}</p>
					<p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
				</Link>
			))}
		</div>
	);
}
