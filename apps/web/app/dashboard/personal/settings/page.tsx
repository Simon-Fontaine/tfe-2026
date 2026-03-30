import { redirect } from "next/navigation";

export default function PersonalSettingsRootPage() {
	redirect("/dashboard/settings/account");
}
