"use server";

import { redirect } from "next/navigation";
import { apiAuthPost } from "@/lib/api-client";
import { deleteSessionTokenCookie } from "@/lib/auth/session";
import { apiRoutes } from "@/lib/routes";

export async function signOutAction() {
	await apiAuthPost(apiRoutes.auth.logout);
	await deleteSessionTokenCookie();
	redirect("/");
}
