export default async function OrgProfilePage({ params }: { params: Promise<{ orgId: string }> }) {
	const { orgId } = await params;
	return (
		<div className="container mx-auto py-8">
			<h1 className="text-3xl font-bold mb-6">Organization Profile</h1>
			<p className="text-muted-foreground">Public profile for organization ID: {orgId}.</p>
		</div>
	);
}
