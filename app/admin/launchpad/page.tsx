import { redirect } from "next/navigation";

// The launchpad now lives in the first tab of the admin dashboard. Keep the
// old route working for bookmarks and external links.
export default function AdminLaunchpadPage() {
  redirect("/admin");
}
