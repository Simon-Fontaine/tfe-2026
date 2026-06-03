import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PublicFilterOption = {
	label: string;
	href: string;
	active: boolean;
};

interface PublicFilterBarProps {
	options: PublicFilterOption[];
	className?: string;
}

export function PublicFilterBar({ options, className }: PublicFilterBarProps) {
	return (
		<div className={cn("flex flex-wrap gap-2", className)}>
			{options.map((option) => (
				<Button
					key={`${option.href}-${option.label}`}
					asChild
					size="sm"
					variant={option.active ? "default" : "outline"}
					className="h-7 px-2.5 text-xs"
				>
					<Link href={option.href}>{option.label}</Link>
				</Button>
			))}
		</div>
	);
}
