import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function POST(request: Request) {
	const cookieStore = await cookies();
	const formData = await request.formData();

	const res = await fetch(`${API_URL}/api/uploads/avatar`, {
		method: "POST",
		headers: { cookie: cookieStore.toString() },
		body: formData,
	});

	const data = await res.json();
	return NextResponse.json(data, { status: res.status });
}

export async function DELETE() {
	const cookieStore = await cookies();

	const res = await fetch(`${API_URL}/api/uploads/avatar`, {
		method: "DELETE",
		headers: { cookie: cookieStore.toString() },
	});

	const data = await res.json();
	return NextResponse.json(data, { status: res.status });
}
