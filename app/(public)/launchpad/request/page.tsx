import { redirect } from "next/navigation";

/**
 * The collection request form now lives at "/create", separate from the
 * launchpad. Keep the old URL working for bookmarks and shared links.
 */
export default async function LaunchpadRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const initialId = typeof rawId === "string" ? rawId.trim() : "";

  redirect(initialId ? `/create?id=${encodeURIComponent(initialId)}` : "/create");
}
