import { redirect } from "next/navigation";

export default function MeIndexPage() {
	redirect("/dashboard/me/profile");
}
