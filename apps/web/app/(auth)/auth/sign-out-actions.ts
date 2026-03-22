"use server";

import { redirect } from "next/navigation";
import { apiAuthPost } from "@/lib/api-client";
import { deleteSessionTokenCookie } from "@/lib/auth/session";

export async function signOutAction() {
	await apiAuthPost("/api/auth/logout");
	await deleteSessionTokenCookie();
	redirect("/");
}
