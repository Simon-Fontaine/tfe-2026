import { redirect } from "next/navigation";

export default function ContextRootPage() {
	redirect("/dashboard/orgs");
}
