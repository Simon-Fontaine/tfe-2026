export default async function PlayerProfilePage({
	params,
}: {
	params: Promise<{ username: string }>;
}) {
	const { username } = await params;
	return (
		<div className="container mx-auto py-8">
			<h1 className="text-3xl font-bold mb-6">{username}'s Profile</h1>
			<p className="text-muted-foreground">Public player details and stats.</p>
		</div>
	);
}
