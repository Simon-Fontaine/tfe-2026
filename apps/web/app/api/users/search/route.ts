import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function GET(request: Request) {
	const cookieStore = await cookies();
	const { searchParams } = new URL(request.url);

	const res = await fetch(`${API_URL}/api/users/search?${searchParams.toString()}`, {
		headers: { cookie: cookieStore.toString() },
	});

	const data = await res.json();
	return NextResponse.json(data, { status: res.status });
}
