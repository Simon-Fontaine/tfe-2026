import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/routes";

export default function AppMePage() {
	redirect(appRoutes.root);
}
