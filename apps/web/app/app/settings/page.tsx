import { appRoutes } from "@scrimflow/shared";
import { redirect } from "next/navigation";

export default function SettingsPage() {
	redirect(appRoutes.settings.account);
}
