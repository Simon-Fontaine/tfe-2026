import { redirect } from "next/navigation";
import { appRoutes } from "@/lib/routes";

export default function SettingsPage() {
	redirect(appRoutes.settings.account);
}
