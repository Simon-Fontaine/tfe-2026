export default function ProfileLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			<div>
				<h1 className="text-lg font-bold">Your profile</h1>
				<p className="text-xs text-muted-foreground">
					Manage your player profile, roles and hero pool
				</p>
			</div>
			{children}
		</div>
	);
}
