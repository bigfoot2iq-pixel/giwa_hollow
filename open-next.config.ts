import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No R2/incremental cache configured: every page in this app is either static
// (prerendered at build time and served as an asset) or fully dynamic.
// Add the r2IncrementalCache override here if you start using ISR.
export default defineCloudflareConfig({});
