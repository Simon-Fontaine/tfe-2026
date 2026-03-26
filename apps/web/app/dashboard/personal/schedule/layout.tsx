export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			<div>
				<h1 className="text-lg font-bold">Schedule</h1>
				<p className="text-xs text-muted-foreground">
					Set your recurring availability and one-off dates for scrim scheduling
				</p>
			</div>
			{children}
		</div>
	);
}
