import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { searchUsersByDisplayName } from "@/lib/data/team";

export async function GET(request: Request) {
	const { session, user } = await getCurrentSession();
	if (!session || !user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const q = searchParams.get("q")?.trim() ?? "";
	const excludeTeamId = searchParams.get("excludeTeamId") ?? undefined;

	if (q.length < 2) {
		return NextResponse.json({ users: [] });
	}

	const users = await searchUsersByDisplayName(q, excludeTeamId, 10);
	return NextResponse.json({ users });
}
