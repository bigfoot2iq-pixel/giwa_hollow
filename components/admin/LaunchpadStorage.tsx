"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminStatus } from "@/lib/hooks";
import {
  adminAuthHeaders,
  useAdminAuth,
} from "@/lib/hooks/useAdminAuth";
import type {
  FinalizeReport,
  ImageExtension,
  StorageStatusResponse,
  UploadSessionResponse,
  VersionSummary,
} from "@/lib/launchpad/storage-types";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const DEFAULT_SUPPLY = 2222;
const IMAGE_EXTENSIONS: readonly ImageExtension[] = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "avif",
];
const IMAGE_EXTENSION_SET = new Set<string>(IMAGE_EXTENSIONS);
const METADATA_BATCH_SIZE = 25;
const UPLOAD_CONCURRENCY = 4;

type Phase =
  | "idle"
  | "reading"
  | "uploading"
  | "metadata"
  | "finalizing"
  | "complete";

interface LocalImage {
  id: number;
  file: File;
  ext: ImageExtension;
  bytes: number;
}

interface UploadProgress {
  imagesTotal: number;
  imagesDone: number;
  metadataTotal: number;
  metadataDone: number;
  bytesTotal: number;
  bytesDone: number;
  failed: number;
  current: string;
}

interface PreviewImage {
  tokenId: number;
  url: string;
}

interface ValidationResult {
  errors: string[];
  warnings: string[];
  imageExtension: ImageExtension | null;
  totalBytes: number;
  missingImages: number[];
  missingMetadata: number[];
  ipfsRefs: number;
  traitCount: number;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseImageFile(file: File): LocalImage | null {
  const match = /^(\d+)\.([a-z0-9]+)$/i.exec(file.name);
  if (!match) return null;

  const id = Number(match[1]);
  const ext = match[2].toLowerCase();

  if (!Number.isSafeInteger(id) || id < 1 || !IMAGE_EXTENSION_SET.has(ext)) {
    return null;
  }

  return { id, file, ext: ext as ImageExtension, bytes: file.size };
}

function parseMetadataId(file: File): number | null {
  const match = /^(\d+)\.json$/i.exec(file.name);
  if (!match) return null;

  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id >= 1 ? id : null;
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run())
  );
}

function summarizeVersion(version: VersionSummary): string {
  if (version.active) return "Active";
  if (version.complete) return "Ready";
  return "Pending";
}

function versionStatusClass(version: VersionSummary): string {
  if (version.active) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (version.complete) {
    return "border-iris/25 bg-iris/10 text-iris";
  }
  return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

export function LaunchpadStorage() {
  const { wallet, getAdminAuth } = useAdminAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminStatus(wallet);

  const [status, setStatus] = useState<StorageStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [images, setImages] = useState<LocalImage[]>([]);
  const [metadata, setMetadata] = useState<Map<number, Record<string, unknown>>>(
    new Map()
  );
  const [selectionErrors, setSelectionErrors] = useState<string[]>([]);
  const [ignoredFiles, setIgnoredFiles] = useState(0);
  const [generateMetadata, setGenerateMetadata] = useState(false);
  const [readingFiles, setReadingFiles] = useState(false);

  const [collectionName, setCollectionName] = useState("ARIWA Genesis");
  const [collectionDescription, setCollectionDescription] = useState(
    "The first collection on Giwa chain"
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [resumeVersion, setResumeVersion] = useState<string | null>(null);
  const [forceNewVersion, setForceNewVersion] = useState(false);
  const [report, setReport] = useState<FinalizeReport | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [previewVersion, setPreviewVersion] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [previewMetadata, setPreviewMetadata] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const imagesInputRef = useRef<HTMLInputElement>(null);
  const metadataInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const phaseRef = useRef<Phase>("idle");
  const statusRequestRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    imagesInputRef.current?.setAttribute("webkitdirectory", "");
    metadataInputRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  const loadStatus = useCallback(
    async (silent = false) => {
      if (!wallet || !isAdmin) return;

      const requestId = ++statusRequestRef.current;
      if (!silent) setStatusLoading(true);

      try {
        const auth = await getAdminAuth();
        const response = await fetch("/api/admin/launchpad/storage/status", {
          headers: adminAuthHeaders(auth),
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));

        if (requestId !== statusRequestRef.current) return;

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load storage status");
        }

        setStatus(data as StorageStatusResponse);
        setStatusError(null);
      } catch (error) {
        if (requestId !== statusRequestRef.current) return;
        setStatusError(
          error instanceof Error ? error.message : "Failed to load storage status"
        );
      } finally {
        if (requestId === statusRequestRef.current) setStatusLoading(false);
      }
    },
    [wallet, isAdmin, getAdminAuth]
  );

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (
        phaseRef.current === "uploading" ||
        phaseRef.current === "metadata" ||
        phaseRef.current === "finalizing"
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const supply = status?.supply || DEFAULT_SUPPLY;

  const handleImageFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const nextImages: LocalImage[] = [];
    const errors: string[] = [];
    const seen = new Set<number>();
    let ignored = 0;

    for (const file of Array.from(files)) {
      if (file.name.startsWith(".")) continue;

      const image = parseImageFile(file);
      if (!image) {
        ignored += 1;
        continue;
      }
      if (seen.has(image.id)) {
        errors.push(`Duplicate image for token ${image.id}`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        errors.push(`${file.name} is larger than 12 MB`);
      }
      seen.add(image.id);
      nextImages.push(image);
    }

    nextImages.sort((a, b) => a.id - b.id);
    setImages(nextImages);
    setSelectionErrors(errors);
    setIgnoredFiles(ignored);
    setReport(null);
    setPreviewVersion(null);
    setProgress(null);
    if (phaseRef.current === "complete") setPhase("idle");
  }, []);

  const handleMetadataFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setReadingFiles(true);

    const next = new Map<number, Record<string, unknown>>();
    const seen = new Set<number>();
    const errors: string[] = [];
    let ignored = 0;

    await runPool(Array.from(files), 20, async (file) => {
      if (file.name.startsWith(".")) return;

      const id = parseMetadataId(file);
      if (!id) {
        ignored += 1;
        return;
      }
      if (seen.has(id) || next.has(id)) {
        errors.push(`Duplicate metadata for token ${id}`);
        return;
      }
      seen.add(id);

      try {
        const parsed: unknown = JSON.parse(await file.text());
        if (!isRecord(parsed)) {
          errors.push(`${file.name} is not a JSON object`);
          return;
        }
        next.set(id, parsed);
      } catch {
        errors.push(`${file.name} is not valid JSON`);
      }
    });

    setMetadata(next);
    setSelectionErrors(errors);
    setIgnoredFiles(ignored);
    setGenerateMetadata(false);
    setReport(null);
    setReadingFiles(false);
    setPreviewVersion(null);
    setProgress(null);
    if (phaseRef.current === "complete") setPhase("idle");
  }, []);

  const validation = useMemo<ValidationResult>(() => {
    const errors = [...selectionErrors];
    const warnings: string[] = [];
    const imageIds = new Set(images.map((image) => image.id));
    const extensions = new Set(images.map((image) => image.ext));
    const missingImages: number[] = [];
    const missingMetadata: number[] = [];
    let ipfsRefs = 0;
    let traitCount = 0;
    let totalBytes = 0;

    for (const image of images) totalBytes += image.bytes;

    for (let id = 1; id <= supply; id += 1) {
      if (!imageIds.has(id)) missingImages.push(id);
      if (!metadata.has(id) && !generateMetadata) missingMetadata.push(id);
    }

    if (images.length === 0) {
      errors.push("Choose the images folder to begin.");
    }

    if (extensions.size > 1) {
      errors.push(
        `All images must use one format. Found: ${[...extensions].join(", ")}`
      );
    }

    if (images.length > supply) {
      errors.push(`Found ${images.length} images; the supply is ${supply}.`);
    }

    for (const [id, item] of metadata) {
      if (!imageIds.has(id)) {
        errors.push(`Metadata ${id}.json has no matching image`);
      }

      if (item.edition !== undefined && Number(item.edition) !== id) {
        errors.push(`Metadata ${id}.json has edition ${String(item.edition)}`);
      }

      if (typeof item.name !== "string" || !item.name.trim()) {
        errors.push(`Metadata ${id}.json has no name`);
      }

      if (
        Array.isArray(item.attributes) &&
        item.attributes.some((attribute) => !isRecord(attribute))
      ) {
        errors.push(`Metadata ${id}.json has invalid attributes`);
      } else if (Array.isArray(item.attributes)) {
        traitCount += item.attributes.length;
      }

      if (
        typeof item.image === "string" &&
        (item.image.startsWith("ipfs://") || item.image.includes("/ipfs/"))
      ) {
        ipfsRefs += 1;
      }

      if (
        typeof item.animation_url === "string" &&
        (item.animation_url.startsWith("ipfs://") ||
          item.animation_url.includes("/ipfs/"))
      ) {
        errors.push(
          `Metadata ${id}.json has an IPFS animation_url, which the image proxy cannot serve`
        );
      }
    }

    if (images.length > 0 && missingImages.length > 0) {
      errors.push(
        `${missingImages.length} token images are missing (first: ${missingImages
          .slice(0, 5)
          .join(", ")})`
      );
    }

    if (!generateMetadata && metadata.size > 0 && missingMetadata.length > 0) {
      errors.push(
        `${missingMetadata.length} metadata files are missing (first: ${missingMetadata
          .slice(0, 5)
          .join(", ")})`
      );
    }

    if (!generateMetadata && metadata.size === 0) {
      errors.push(
        "Choose the metadata folder, or tick “Generate simple metadata”."
      );
    }

    if (ipfsRefs > 0) {
      warnings.push(
        `${ipfsRefs} metadata file${ipfsRefs === 1 ? "" : "s"} point at IPFS/Pinata; the image field will be rewritten.`
      );
    }

    if (images.length > 0 && extensions.size === 1) {
      const only = [...extensions][0];
      if (only !== "png") {
        warnings.push(`This collection uses .${only} images (not PNG).`);
      }
    }

    return {
      errors: [...new Set(errors)],
      warnings: [...new Set(warnings)],
      imageExtension: extensions.size === 1 ? [...extensions][0] : null,
      totalBytes,
      missingImages,
      missingMetadata,
      ipfsRefs,
      traitCount,
    };
  }, [
    selectionErrors,
    images,
    metadata,
    supply,
    generateMetadata,
  ]);

  const activeVersion = status?.active?.version || null;
  const pendingVersion = status?.pending?.version || null;
  const selectedPreviewVersion =
    previewVersion || activeVersion || report?.version || pendingVersion;

  useEffect(() => {
    if (!wallet || !selectedPreviewVersion) {
      setPreviewImages([]);
      setPreviewMetadata(null);
      return;
    }

    let cancelled = false;
    const urls: string[] = [];

    async function loadPreview() {
      setPreviewLoading(true);

      try {
        const version = selectedPreviewVersion;
        if (!version) return;

        const auth = await getAdminAuth();
        const versionSummary = status?.versions.find(
          (entry) => entry.version === version
        );
        const ext =
          versionSummary?.record?.imageExtension ||
          (version === report?.version
            ? report?.record.imageExtension
            : validation.imageExtension);

        if (!ext) {
          setPreviewImages([]);
          setPreviewMetadata(null);
          return;
        }

        const ids = [
          1,
          2,
          Math.max(1, Math.ceil(supply / 4)),
          Math.max(1, Math.ceil(supply / 2)),
          Math.max(1, supply - 1),
          supply,
        ];
        const uniqueIds = [...new Set(ids)];

        const results = await Promise.all(
          uniqueIds.map(async (tokenId) => {
            const response = await fetch(
              `/api/admin/launchpad/storage/preview?kind=image&version=${encodeURIComponent(
                version
              )}&tokenId=${tokenId}&ext=${ext}`,
              { headers: adminAuthHeaders(auth), cache: "no-store" }
            );
            if (!response.ok) return null;

            const blob = await response.blob();
            if (cancelled) return null;

            const url = URL.createObjectURL(blob);
            urls.push(url);
            return { tokenId, url };
          })
        );

        if (!cancelled) {
          setPreviewImages(
            results.filter((result): result is PreviewImage => !!result)
          );
        }

        const metadataResponse = await fetch(
          `/api/admin/launchpad/storage/preview?kind=metadata&version=${encodeURIComponent(
            version
          )}&tokenId=1`,
          { headers: adminAuthHeaders(auth), cache: "no-store" }
        );

        if (!cancelled) {
          if (metadataResponse.ok) {
            const data = await metadataResponse.json();
            setPreviewMetadata(isRecord(data) ? data : null);
          } else {
            setPreviewMetadata(null);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading launchpad preview:", error);
          setPreviewImages([]);
          setPreviewMetadata(null);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [
    wallet,
    getAdminAuth,
    selectedPreviewVersion,
    status?.versions,
    report,
    validation.imageExtension,
    supply,
  ]);

  async function refreshUploadToken(version: string): Promise<string> {
    const auth = await getAdminAuth();
    const response = await fetch("/api/admin/launchpad/storage/session", {
      method: "POST",
      headers: {
        ...adminAuthHeaders(auth),
        "content-type": "application/json",
      },
      body: JSON.stringify({ version }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || typeof data?.token !== "string") {
      throw new Error(data?.error || "Could not refresh the upload session");
    }

    return data.token as string;
  }

  async function uploadImage(
    image: LocalImage,
    version: string,
    token: string
  ): Promise<string> {
    let currentToken = token;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await fetch(
        `/api/admin/launchpad/storage/upload?version=${encodeURIComponent(
          version
        )}&tokenId=${image.id}&ext=${image.ext}`,
        {
          method: "POST",
          headers: {
            "x-upload-token": currentToken,
            "content-type": "application/octet-stream",
          },
          body: image.file,
        }
      );

      if (response.ok) return currentToken;

      if (response.status === 401) {
        currentToken = await refreshUploadToken(version);
        continue;
      }

      if (response.status >= 500 || response.status === 429) {
        await sleep(400 * attempt);
        continue;
      }

      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || `Upload failed (${response.status})`);
    }

    throw new Error(`Upload failed after retries: ${image.file.name}`);
  }

  async function startUpload() {
    if (validation.errors.length > 0) {
      toast.error("Fix the validation errors first");
      return;
    }

    const imageExtension = validation.imageExtension;
    if (!imageExtension) {
      toast.error("Images must all use one format");
      return;
    }

    cancelRef.current = false;
    setReport(null);
    setPhase("uploading");

    const totalBytes = validation.totalBytes;
    const imagesTotal = images.length;
    let imagesDone = 0;
    let bytesDone = 0;
    let failed = 0;

    setProgress({
      imagesTotal,
      imagesDone: 0,
      metadataTotal: supply,
      metadataDone: 0,
      bytesTotal: totalBytes,
      bytesDone: 0,
      failed: 0,
      current: "Opening upload session…",
    });

    try {
      const auth = await getAdminAuth();
      const sessionResponse = await fetch(
        "/api/admin/launchpad/storage/session",
        {
          method: "POST",
          headers: {
            ...adminAuthHeaders(auth),
            "content-type": "application/json",
          },
          body: JSON.stringify(
            resumeVersion
              ? { version: resumeVersion }
              : forceNewVersion
                ? { newVersion: true }
                : {}
          ),
        }
      );
      const sessionData = await sessionResponse.json().catch(() => ({}));

      if (!sessionResponse.ok) {
        if (sessionData?.complete) {
          toast.error(
            "That version is already finalized. Activate it from the version history."
          );
          setPhase("idle");
          await loadStatus(true);
          return;
        }
        throw new Error(sessionData?.error || "Could not start the upload");
      }

      const session = sessionData as UploadSessionResponse;
      let uploadToken = session.token;
      const uploaded = new Set(session.uploadedImageIds);
      const queue = images.filter((image) => !uploaded.has(image.id));

      imagesDone = uploaded.size;
      bytesDone = images
        .filter((image) => uploaded.has(image.id))
        .reduce((total, image) => total + image.bytes, 0);

      setProgress({
        imagesTotal,
        imagesDone,
        metadataTotal: supply,
        metadataDone: session.uploadedMetadataIds.length,
        bytesTotal: totalBytes,
        bytesDone,
        failed: 0,
        current: queue.length
          ? `Uploading ${queue.length} image${queue.length === 1 ? "" : "s"}…`
          : "All images already uploaded. Preparing metadata…",
      });

      await runPool(queue, UPLOAD_CONCURRENCY, async (image) => {
        if (cancelRef.current) return;

        setProgress((current) =>
          current ? { ...current, current: `Uploading ${image.file.name}` } : current
        );

        try {
          uploadToken = await uploadImage(
            image,
            session.version,
            uploadToken
          );
          imagesDone += 1;
          bytesDone += image.bytes;
        } catch (error) {
          failed += 1;
          console.error(`Failed to upload ${image.file.name}:`, error);
        }

        setProgress((current) =>
          current
            ? {
                ...current,
                imagesDone,
                bytesDone,
                failed,
                current: current.current,
              }
            : current
        );
      });

      if (cancelRef.current) {
        cancelRef.current = false;
        setPhase("idle");
        toast.info("Upload paused. Resume it from the pending version.");
        await loadStatus(true);
        return;
      }

      if (failed > 0) {
        throw new Error(
          `${failed} image${failed === 1 ? "" : "s"} failed to upload. Resume to retry them.`
        );
      }

      setPhase("metadata");
      setProgress((current) =>
        current
          ? {
              ...current,
              current: "Writing metadata…",
              imagesDone: imagesTotal,
            }
          : current
      );

      const items = Array.from({ length: supply }, (_, index) => {
        const id = index + 1;
        const supplied = metadata.get(id);

        return {
          tokenId: id,
          metadata:
            supplied ??
            ({
              name: `${collectionName} #${id}`,
              description: collectionDescription,
              image: "",
              edition: id,
              attributes: [],
            } satisfies Record<string, unknown>),
        };
      });

      let metadataDone = 0;

      for (let index = 0; index < items.length; index += METADATA_BATCH_SIZE) {
        if (cancelRef.current) break;

        const batch = items.slice(index, index + METADATA_BATCH_SIZE);
        const response = await fetch(
          "/api/admin/launchpad/storage/metadata",
          {
            method: "POST",
            headers: {
              "x-upload-token": uploadToken,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              version: session.version,
              imageExtension,
              items: batch,
            }),
          }
        );
        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
          uploadToken = await refreshUploadToken(session.version);
          index -= METADATA_BATCH_SIZE;
          continue;
        }

        if (!response.ok) {
          throw new Error(data?.error || "Could not write metadata");
        }

        const written = Number(data?.written || 0);
        metadataDone += written;
        setProgress((current) =>
          current
            ? {
                ...current,
                metadataDone,
                current: `Metadata ${Math.min(
                  metadataDone,
                  supply
                )}/${supply}`,
              }
            : current
        );

        if (written !== batch.length) {
          const failures = Array.isArray(data?.results)
            ? data.results
                .filter((result: { ok?: boolean }) => !result?.ok)
                .slice(0, 5)
                .map(
                  (result: { tokenId?: number; error?: string }) =>
                    `#${result.tokenId}: ${result.error || "failed"}`
                )
                .join("; ")
            : "";

          throw new Error(
            `Only ${written}/${batch.length} metadata files were written${
              failures ? ` — ${failures}` : ""
            }`
          );
        }
      }

      if (cancelRef.current) {
        cancelRef.current = false;
        setPhase("idle");
        toast.info("Upload paused. Resume it from the pending version.");
        await loadStatus(true);
        return;
      }

      setPhase("finalizing");
      setProgress((current) =>
        current ? { ...current, current: "Verifying and publishing…" } : current
      );

      const finalizeAuth = await getAdminAuth();
      const finalizeResponse = await fetch(
        "/api/admin/launchpad/storage/finalize",
        {
          method: "POST",
          headers: {
            ...adminAuthHeaders(finalizeAuth),
            "content-type": "application/json",
          },
          body: JSON.stringify({
            version: session.version,
            name: collectionName,
            description: collectionDescription,
          }),
        }
      );
      const finalizeData = await finalizeResponse.json().catch(() => ({}));

      if (!finalizeResponse.ok) {
        if (finalizeData?.complete && finalizeData?.record) {
          toast.info("That version is already finalized.");
          await loadStatus(true);
          setPhase("complete");
          return;
        }
        throw new Error(finalizeData?.error || "Could not finalize the version");
      }

      setReport(finalizeData as FinalizeReport);
      setPhase("complete");
      setForceNewVersion(false);
      setPreviewVersion((finalizeData as FinalizeReport).version);
      toast.success(`Version ${(finalizeData as FinalizeReport).version} is published`);
      await loadStatus(true);
    } catch (error) {
      console.error("Launchpad upload failed:", error);
      toast.error(
        error instanceof Error ? error.message : "The upload could not finish"
      );
      setPhase("idle");
      await loadStatus(true);
    }
  }

  async function activateVersion(version: string) {
    const isRollback = !!status?.active && status.active.version !== version;
    const message = isRollback
      ? `Activate ${version}? This rolls the public collection back to that version for all ${supply} tokens.`
      : `Activate ${version}? This changes the artwork and metadata served for all ${supply} tokens.`;

    if (!window.confirm(message)) return;

    setActionLoading(`activate-${version}`);

    try {
      const auth = await getAdminAuth();
      const response = await fetch(
        "/api/admin/launchpad/storage/activate",
        {
          method: "POST",
          headers: {
            ...adminAuthHeaders(auth),
            "content-type": "application/json",
          },
          body: JSON.stringify({ version }),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Could not activate the version");
      }

      toast.success(
        `${version} is active. Public metadata updates within about a minute.`
      );
      setPreviewVersion(version);
      await loadStatus(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not activate the version"
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteVersion(version: string) {
    if (
      !window.confirm(
        `Delete ${version} and every image/metadata file in it? This cannot be undone.`
      )
    ) {
      return;
    }

    setActionLoading(`delete-${version}`);

    try {
      const auth = await getAdminAuth();
      const response = await fetch(
        `/api/admin/launchpad/storage/pending?version=${encodeURIComponent(
          version
        )}`,
        {
          method: "DELETE",
          headers: adminAuthHeaders(auth),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Could not delete the version");
      }

      toast.success(`Deleted ${data?.deleted ?? 0} objects from ${version}`);
      if (resumeVersion === version) setResumeVersion(null);
      if (previewVersion === version) setPreviewVersion(null);
      await loadStatus(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the version"
      );
    } finally {
      setActionLoading(null);
    }
  }

  const busy =
    phase === "uploading" ||
    phase === "metadata" ||
    phase === "finalizing";
  const progressPercent =
    progress && progress.imagesTotal + progress.metadataTotal > 0
      ? Math.round(
          ((progress.imagesDone + progress.metadataDone) /
            (progress.imagesTotal + progress.metadataTotal)) *
            100
        )
      : 0;

  if (!wallet) {
    return (
      <div className="ui-container rounded-[26px] p-6">
        <p className="eyebrow">Collection storage</p>
        <h3 className="mt-3 font-header text-xl font-extrabold tracking-[-0.03em] text-ink">
          Artwork &amp; metadata
        </h3>
        <p className="mt-2 text-[12px] leading-6 text-ink-mute">
          Connect the admin wallet to upload the collection images and JSON to
          private Cloudflare R2 storage.
        </p>
      </div>
    );
  }

  if (adminLoading) {
    return (
      <div className="ui-container rounded-[26px] p-6">
        <p className="eyebrow">Collection storage</p>
        <h3 className="mt-3 font-header text-xl font-extrabold tracking-[-0.03em] text-ink">
          Artwork &amp; metadata
        </h3>
        <p className="mt-2 flex items-center gap-2 text-[12px] leading-6 text-ink-mute">
          <Loader2 className="size-3.5 animate-spin" />
          Checking admin access…
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="ui-container rounded-[26px] p-6">
        <p className="eyebrow">Collection storage</p>
        <h3 className="mt-3 font-header text-xl font-extrabold tracking-[-0.03em] text-ink">
          Artwork &amp; metadata
        </h3>
        <p className="mt-2 text-[12px] leading-6 text-ink-mute">
          The connected wallet is not an admin. Connect{" "}
          <span className="font-mono text-[10px] text-ink-soft">
            NEXT_PUBLIC_ADMIN_WALLET
          </span>{" "}
          to manage collection storage.
        </p>
      </div>
    );
  }

  return (
    <div className="ui-container overflow-hidden rounded-[26px]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/[0.08] px-6 py-5">
        <div>
          <p className="eyebrow">Collection storage</p>
          <h3 className="mt-2 font-header text-2xl font-extrabold tracking-[-0.03em] text-ink">
            Artwork &amp; metadata
          </h3>
          <p className="mt-2 max-w-2xl text-[12px] leading-6 text-ink-mute">
            Upload the HashLips images and JSON. Files stay private in Cloudflare
            R2; only the public{" "}
            <span className="font-mono text-[10px] text-ink-soft">
              /api/launchpad
            </span>{" "}
            routes serve them to holders and the explorer.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadStatus()}
          disabled={statusLoading}
          className="btn-soft h-10 px-3 text-[10px]"
        >
          <RefreshCw
            className={`size-3.5 ${statusLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {statusError && (
        <div className="flex items-start gap-3 border-b border-red-500/20 bg-red-500/10 px-6 py-4">
          <XCircle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-300" />
          <p className="text-[12px] leading-5 text-red-700 dark:text-red-200">
            {statusError}
          </p>
        </div>
      )}

      <div className="grid gap-3 border-b border-ink/[0.08] px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-ink/[0.08] bg-ink/[0.02] p-4">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-faint">
            Active source
          </p>
          <p className="mt-2 text-sm font-bold text-ink">
            {statusLoading
              ? "Loading…"
              : status?.active
                ? `Cloudflare R2 · ${status.active.version}`
                : "Pinata (legacy)"}
          </p>
          {status?.active && (
            <p className="mt-1 font-mono text-[9px] text-ink-faint">
              {status.active.imageExtension.toUpperCase()} ·{" "}
              {formatBytes(status.versions.find((v) => v.active)?.totalBytes || 0)}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-ink/[0.08] bg-ink/[0.02] p-4">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-faint">
            Supply
          </p>
          <p className="mt-2 text-sm font-bold text-ink">
            {supply.toLocaleString()} tokens
          </p>
        </div>

        <div className="rounded-2xl border border-ink/[0.08] bg-ink/[0.02] p-4">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-faint">
            Images
          </p>
          <p className="mt-2 text-sm font-bold text-ink">
            {images.length > 0
              ? `${images.length.toLocaleString()} selected`
              : status?.active
                ? `${(status.versions.find((v) => v.active)?.imageCount || 0).toLocaleString()} live`
                : "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-ink/[0.08] bg-ink/[0.02] p-4">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-faint">
            Metadata
          </p>
          <p className="mt-2 text-sm font-bold text-ink">
            {metadata.size > 0
              ? `${metadata.size.toLocaleString()} selected`
              : generateMetadata
                ? "Generated on upload"
                : status?.active
                  ? `${(status.versions.find((v) => v.active)?.metadataCount || 0).toLocaleString()} live`
                  : "—"}
          </p>
        </div>
      </div>

      {pendingVersion && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/10 px-6 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
            <div>
              <p className="text-[12px] font-semibold text-amber-800 dark:text-amber-200">
                Pending {pendingVersion}
              </p>
              <p className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-200/70">
                {(
                  status?.pending?.imageCount || 0
                ).toLocaleString()}{" "}
                images ·{" "}
                {(status?.pending?.metadataCount || 0).toLocaleString()} metadata
                files uploaded. Resume it or discard it.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setResumeVersion(pendingVersion);
                setForceNewVersion(false);
                toast.info(
                  `Select the same folders and press “Resume ${pendingVersion}”.`
                );
              }}
              className="btn-soft h-9 px-3 text-[10px]"
            >
              Resume {pendingVersion}
            </button>
            <button
              type="button"
              onClick={() => void deleteVersion(pendingVersion)}
              disabled={actionLoading === `delete-${pendingVersion}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/10 px-3 text-[10px] font-semibold text-red-700 transition hover:bg-red-500/15 disabled:opacity-40 dark:text-red-300"
            >
              <Trash2 className="size-3" />
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-ink/[0.08] bg-paper/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-faint">
                  Step 1
                </p>
                <h4 className="mt-1 font-header text-lg font-extrabold tracking-[-0.03em] text-ink">
                  Choose the collection files
                </h4>
              </div>
              <FolderOpen className="size-5 text-ink-faint" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => imagesInputRef.current?.click()}
                disabled={busy}
                className="group flex min-h-[96px] flex-col items-start justify-between rounded-xl border border-dashed border-ink/15 bg-cream/40 p-4 text-left transition hover:border-iris/40 hover:bg-iris/[0.04] disabled:opacity-40"
              >
                <ImageIcon className="size-4 text-ink-faint group-hover:text-iris" />
                <span>
                  <span className="block text-[11px] font-semibold text-ink">
                    Images folder
                  </span>
                  <span className="mt-1 block text-[10px] text-ink-mute">
                    {images.length > 0
                      ? `${images.length.toLocaleString()} images · ${formatBytes(
                          validation.totalBytes
                        )}`
                      : "Select build/images"}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => metadataInputRef.current?.click()}
                disabled={busy || readingFiles}
                className="group flex min-h-[96px] flex-col items-start justify-between rounded-xl border border-dashed border-ink/15 bg-cream/40 p-4 text-left transition hover:border-iris/40 hover:bg-iris/[0.04] disabled:opacity-40"
              >
                <Database className="size-4 text-ink-faint group-hover:text-iris" />
                <span>
                  <span className="block text-[11px] font-semibold text-ink">
                    Metadata folder
                  </span>
                  <span className="mt-1 block text-[10px] text-ink-mute">
                    {readingFiles
                      ? "Reading JSON…"
                      : metadata.size > 0
                        ? `${metadata.size.toLocaleString()} JSON files`
                        : "Select build/json"}
                  </span>
                </span>
              </button>
            </div>

            <input
              ref={imagesInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              className="hidden"
              onChange={(event) => handleImageFiles(event.target.files)}
            />
            <input
              ref={metadataInputRef}
              type="file"
              multiple
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => void handleMetadataFiles(event.target.files)}
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-mute">
                  Collection name
                </span>
                <input
                  value={collectionName}
                  onChange={(event) => setCollectionName(event.target.value)}
                  disabled={busy}
                  className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-2.5 text-[12px] text-ink placeholder:text-ink-faint focus:border-iris/50 focus:outline-none focus:ring-1 focus:ring-iris/20 disabled:opacity-50"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-mute">
                  Description
                </span>
                <input
                  value={collectionDescription}
                  onChange={(event) =>
                    setCollectionDescription(event.target.value)
                  }
                  disabled={busy}
                  className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-2.5 text-[12px] text-ink placeholder:text-ink-faint focus:border-iris/50 focus:outline-none focus:ring-1 focus:ring-iris/20 disabled:opacity-50"
                />
              </label>
            </div>

            {metadata.size === 0 && (
              <label className="mt-4 flex items-start gap-2 rounded-xl border border-ink/10 bg-cream/40 p-3">
                <input
                  type="checkbox"
                  checked={generateMetadata}
                  onChange={(event) => setGenerateMetadata(event.target.checked)}
                  disabled={busy}
                  className="mt-0.5 size-3.5 rounded border-ink/20 text-iris focus:ring-iris/30"
                />
                <span className="text-[10.5px] leading-5 text-ink-soft">
                  Generate simple metadata from the images. Use this only if the
                  collection has no HashLips JSON; traits will be empty.
                </span>
              </label>
            )}

            {ignoredFiles > 0 && (
              <p className="mt-3 text-[10px] text-ink-faint">
                Ignored {ignoredFiles} non-token file
                {ignoredFiles === 1 ? "" : "s"}.
              </p>
            )}

            {validation.errors.length > 0 && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-red-700 dark:text-red-300">
                  <XCircle className="size-3.5" />
                  {validation.errors.length} issue
                  {validation.errors.length === 1 ? "" : "s"}
                </p>
                <ul className="mt-2 space-y-1">
                  {validation.errors.slice(0, 8).map((error) => (
                    <li
                      key={error}
                      className="text-[10.5px] leading-5 text-red-700/90 dark:text-red-200/80"
                    >
                      {error}
                    </li>
                  ))}
                </ul>
                {validation.errors.length > 8 && (
                  <p className="mt-1 text-[10px] text-red-700/70 dark:text-red-200/60">
                    +{validation.errors.length - 8} more
                  </p>
                )}
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
                <ul className="space-y-1">
                  {validation.warnings.map((warning) => (
                    <li
                      key={warning}
                      className="text-[10.5px] leading-5 text-amber-800/90 dark:text-amber-200/80"
                    >
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void startUpload()}
                disabled={busy || validation.errors.length > 0}
                className="btn-iris h-10 px-4 text-[10px] disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="size-3.5" />
                )}
                {phase === "uploading"
                  ? "Uploading images…"
                  : phase === "metadata"
                    ? "Writing metadata…"
                    : phase === "finalizing"
                      ? "Publishing…"
                      : resumeVersion
                        ? `Resume ${resumeVersion}`
                        : "Upload & publish"}
              </button>

              {busy && (
                <button
                  type="button"
                  onClick={() => {
                    cancelRef.current = true;
                    toast.info("Stopping after the current file…");
                  }}
                  className="btn-soft h-10 px-3 text-[10px]"
                >
                  Stop
                </button>
              )}

              {resumeVersion && !busy && (
                <button
                  type="button"
                  onClick={() => {
                    setResumeVersion(null);
                    setForceNewVersion(true);
                  }}
                  className="text-[10px] font-semibold text-ink-mute underline-offset-2 hover:underline"
                >
                  Start a new version instead
                </button>
              )}
            </div>

            {!generateMetadata && validation.traitCount > 0 && (
              <p className="mt-3 text-[10px] text-ink-faint">
                {validation.traitCount.toLocaleString()} trait values across the
                selected metadata.
              </p>
            )}
          </div>

          {progress && (busy || phase === "complete") && (
            <div className="rounded-2xl border border-ink/[0.08] bg-paper/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-faint">
                  Upload progress
                </p>
                <p className="font-mono text-[10px] font-bold text-ink">
                  {progressPercent}%
                </p>
              </div>

              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
                className="mt-3 h-2 overflow-hidden rounded-full bg-ink/[0.08]"
              >
                <div
                  className="h-full rounded-full bg-iris transition-[width] duration-300"
                  style={{ width: `${Math.max(progressPercent, 1)}%` }}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[9.5px] text-ink-mute sm:grid-cols-4">
                <span>
                  Images {progress.imagesDone}/{progress.imagesTotal}
                </span>
                <span>
                  Metadata {progress.metadataDone}/{progress.metadataTotal}
                </span>
                <span>
                  {formatBytes(progress.bytesDone)} /{" "}
                  {formatBytes(progress.bytesTotal)}
                </span>
                <span className={progress.failed > 0 ? "text-red-600 dark:text-red-300" : ""}>
                  Failed {progress.failed}
                </span>
              </div>

              <p className="mt-2 truncate font-mono text-[9.5px] text-ink-faint">
                {progress.current}
              </p>
            </div>
          )}

          {report && (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                <div>
                  <p className="text-[12px] font-bold text-emerald-800 dark:text-emerald-200">
                    {report.version} is published and ready to activate
                  </p>
                  <p className="mt-1 text-[10.5px] leading-5 text-emerald-800/80 dark:text-emerald-200/70">
                    {report.imageCount.toLocaleString()} images ·{" "}
                    {report.metadataCount.toLocaleString()} metadata files ·{" "}
                    {formatBytes(report.totalBytes)}. Content hash{" "}
                    <span className="font-mono">
                      {report.contentHash.slice(0, 16)}…
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => void activateVersion(report.version)}
                    disabled={actionLoading === `activate-${report.version}`}
                    className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-[10px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-40"
                  >
                    {actionLoading === `activate-${report.version}` ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    Activate {report.version}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-ink/[0.08] bg-paper/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-faint">
                  Preview
                </p>
                <h4 className="mt-1 font-header text-lg font-extrabold tracking-[-0.03em] text-ink">
                  {selectedPreviewVersion
                    ? `Token 1 · ${selectedPreviewVersion}`
                    : "No version yet"}
                </h4>
              </div>
              {previewLoading && (
                <Loader2 className="size-4 animate-spin text-ink-faint" />
              )}
            </div>

            {previewImages.length > 0 ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {previewImages.map((image) => (
                  <div
                    key={image.tokenId}
                    className="relative aspect-square overflow-hidden rounded-xl border border-ink/10 bg-cream-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={`Token ${image.tokenId}`}
                      className="size-full object-cover"
                    />
                    <span className="absolute bottom-1 left-1 rounded bg-ink/70 px-1.5 py-0.5 font-mono text-[8px] text-cream">
                      #{image.tokenId}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 flex aspect-[3/1] items-center justify-center rounded-xl border border-dashed border-ink/10 bg-cream/30">
                <p className="text-[10px] text-ink-faint">
                  Upload a version to preview its artwork.
                </p>
              </div>
            )}

            {previewMetadata && (
              <div className="mt-4 rounded-xl border border-ink/[0.08] bg-cream/30 p-3">
                <p className="text-[11px] font-bold text-ink">
                  {String(previewMetadata.name || "Token 1")}
                </p>
                <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-ink-mute">
                  {String(previewMetadata.description || "")}
                </p>
                {Array.isArray(previewMetadata.attributes) &&
                  previewMetadata.attributes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {previewMetadata.attributes
                        .filter(isRecord)
                        .slice(0, 8)
                        .map((attribute, index) => (
                          <span
                            key={`${String(attribute.trait_type)}-${index}`}
                            className="rounded-full border border-ink/10 bg-paper px-2 py-0.5 font-mono text-[8px] text-ink-soft"
                          >
                            {String(attribute.trait_type)}:{" "}
                            {String(attribute.value)}
                          </span>
                        ))}
                    </div>
                  )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-ink/[0.08] bg-paper/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-faint">
                  Versions
                </p>
                <h4 className="mt-1 font-header text-lg font-extrabold tracking-[-0.03em] text-ink">
                  Version history
                </h4>
              </div>
              <Database className="size-4 text-ink-faint" />
            </div>

            {status?.versions && status.versions.length > 0 ? (
              <div className="mt-3 space-y-2">
                {[...status.versions].reverse().map((version) => (
                  <div
                    key={version.version}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-ink/[0.08] bg-cream/30 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-[11px] font-bold text-ink">
                          {version.version}
                        </p>
                        <span
                          className={`rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] ${versionStatusClass(
                            version
                          )}`}
                        >
                          {summarizeVersion(version)}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-mono text-[9px] text-ink-faint">
                        {(version.imageCount || 0).toLocaleString()} images ·{" "}
                        {(version.metadataCount || 0).toLocaleString()} metadata ·{" "}
                        {formatBytes(version.totalBytes || 0)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!version.complete && !version.active && (
                        <button
                          type="button"
                          onClick={() => {
                            setResumeVersion(version.version);
                            setForceNewVersion(false);
                            toast.info(
                              `Select the same folders and press “Resume ${version.version}”.`
                            );
                          }}
                          className="rounded-full border border-ink/10 bg-paper px-2.5 py-1 text-[9px] font-semibold text-ink-soft transition hover:bg-ink/[0.04]"
                        >
                          Resume
                        </button>
                      )}

                      {version.complete && !version.active && (
                        <button
                          type="button"
                          onClick={() => void activateVersion(version.version)}
                          disabled={actionLoading === `activate-${version.version}`}
                          className="rounded-full border border-iris/25 bg-iris/10 px-2.5 py-1 text-[9px] font-semibold text-iris transition hover:bg-iris/15 disabled:opacity-40"
                        >
                          {actionLoading === `activate-${version.version}`
                            ? "Activating…"
                            : status?.active
                              ? "Roll back"
                              : "Activate"}
                        </button>
                      )}

                      {!version.active && (
                        <button
                          type="button"
                          onClick={() => void deleteVersion(version.version)}
                          disabled={actionLoading === `delete-${version.version}`}
                          className="rounded-full border border-red-500/20 bg-red-500/[0.06] p-1.5 text-red-600 transition hover:bg-red-500/10 disabled:opacity-40 dark:text-red-300"
                          aria-label={`Delete ${version.version}`}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}

                      {version.active && (
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Live
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[10.5px] leading-5 text-ink-mute">
                No R2 versions yet. The public collection is still served from
                Pinata.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
