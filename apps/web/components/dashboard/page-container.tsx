import { cn } from "@/lib/utils";

const maxWidthClasses = {
	"4xl": "max-w-4xl",
	"5xl": "max-w-5xl",
	full: "max-w-full",
} as const;

interface PageContainerProps {
	children: React.ReactNode;
	maxWidth?: keyof typeof maxWidthClasses;
	className?: string;
}

export function PageContainer({ children, maxWidth = "5xl", className }: PageContainerProps) {
	return (
		<div
			className={cn(
				"mx-auto w-full space-y-6 px-4 py-6 sm:px-6",
				maxWidthClasses[maxWidth],
				className
			)}
		>
			{children}
		</div>
	);
}
