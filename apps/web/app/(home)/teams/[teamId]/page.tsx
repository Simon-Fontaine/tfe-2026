export default async function TeamProfilePage({ params }: { params: Promise<{ teamId: string }> }) {
	const { teamId } = await params;
	return (
		<div className="container mx-auto py-8">
			<h1 className="text-3xl font-bold mb-6">Team Profile</h1>
			<p className="text-muted-foreground">
				Public roster and recent results for team ID: {teamId}.
			</p>
		</div>
	);
}
