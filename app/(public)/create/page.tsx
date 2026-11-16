import type { Metadata } from "next";
import { LaunchpadRequestSection } from "@/components/launchpad/LaunchpadRequestSection";

export const metadata: Metadata = {
  title: "Create",
  description:
    "Request a collection launch on ARIWA. We build the contract, mint page, and launch schedule for approved projects on GIWA.",
  openGraph: {
    title: "Create a collection · ARIWA",
    description:
      "Request a collection launch on ARIWA. We build the contract, mint page, and launch schedule for approved projects on GIWA.",
    type: "website",
  },
};

export default async function CreatePage({
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
