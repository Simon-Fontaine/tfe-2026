import { redirect } from "next/navigation";

export default function PersonalRootPage() {
	redirect("/dashboard/profile");
}
