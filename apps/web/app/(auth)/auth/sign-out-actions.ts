"use server";

import { apiRoutes } from "@scrimflow/shared";
import { redirect } from "next/navigation";
import { apiAuthPost } from "@/lib/api-client";
import { deleteSessionTokenCookie } from "@/lib/auth/session";

export async function signOutAction() {
	await apiAuthPost(apiRoutes.auth.logout);
	await deleteSessionTokenCookie();
	redirect("/");
}
