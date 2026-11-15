"use client";

import { useState } from "react";
import { LaunchpadRequestForm } from "./LaunchpadRequestForm";
import { LaunchpadRequestStatus } from "./LaunchpadRequestStatus";

/**
 * Ties the public request form to the status tracker: once a submission
 * succeeds, the returned reference ID is pushed straight into the tracker and
 * scrolled into view, so the user immediately sees the request's status.
 */
export function LaunchpadRequestSection({
  initialId = "",
}: {
  initialId?: string;
}) {
  const [trackedId, setTrackedId] = useState(initialId.trim());

  const handleSubmitted = (id: string) => {
    setTrackedId(id);
    window.setTimeout(() => {
      document
        .getElementById("request-status")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  return (
    <div className="space-y-6">
      <section id="request-status" className="scroll-mt-24">
        <LaunchpadRequestStatus
          key={trackedId || "empty"}
          initialId={trackedId}
        />
      </section>
      <LaunchpadRequestForm onSubmitted={handleSubmitted} />
    </div>
  );
}
