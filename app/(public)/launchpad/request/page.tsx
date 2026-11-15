import { LaunchpadRequestSection } from "@/components/launchpad/LaunchpadRequestSection";

export default async function LaunchpadRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const initialId = typeof rawId === "string" ? rawId.trim() : "";

  return (
    <div className="page-shell">
      <LaunchpadRequestSection initialId={initialId} />
    </div>
  );
}
