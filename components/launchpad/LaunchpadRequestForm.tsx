"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/ui/date-time-picker";

interface FormState {
  collection_name: string;
  symbol: string;
  description: string;
  supply: string;
  mint_price: string;
  launch_date: string;
  creator_wallet: string;
  contact_email: string;
  contact_x: string;
  website_url: string;
  x_url: string;
  discord_url: string;
  artwork_url: string;
  notes: string;
}

const initialState: FormState = {
  collection_name: "",
  symbol: "",
  description: "",
  supply: "1000",
  mint_price: "0.01",
  launch_date: "",
  creator_wallet: "",
  contact_email: "",
  contact_x: "",
  website_url: "",
  x_url: "",
  discord_url: "",
  artwork_url: "",
  notes: "",
};

function Field({
  name,
  label,
  required,
  hint,
  error,
  children,
}: {
  name?: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block" data-field={name}>
      <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">
        {label} {required && <span className="text-red-600 dark:text-red-300">*</span>}
      </span>
      {children}
      {error ? (
        <span
          role="alert"
          className="mt-1 block text-[10px] font-semibold text-red-600 dark:text-red-300"
        >
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-[10px] text-ink-mute">{hint}</span>
      ) : null}
    </label>
  );
}

function focusFirstError(errors: Record<string, string>) {
  const first = Object.keys(errors)[0];
  if (!first) return;

  const field = document.querySelector<HTMLElement>(
    `[data-field="${first}"]`
  );
  field?.scrollIntoView({ behavior: "smooth", block: "center" });
  field
    ?.querySelector<HTMLElement>("input, textarea, select, button")
    ?.focus({ preventScroll: true });
}

const inputClass =
  "w-full rounded-xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-iris/50 focus:outline-none focus:ring-1 focus:ring-iris/25";

export function LaunchpadRequestForm({
  onSubmitted,
}: {
  onSubmitted?: (id: string) => void;
}) {
  const { address, isConnected } = useAccount();
  const [form, setForm] = useState<FormState>(initialState);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (address && !form.creator_wallet) {
      setForm((current) => ({ ...current, creator_wallet: address }));
    }
  }, [address, form.creator_wallet]);

  const update = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!/^(?:\d+\.?\d*|\.\d+)$/.test(form.mint_price)) {
      toast.error("Mint price must be a number, e.g. 0.01");
      return;
    }

    if (!form.launch_date) {
      toast.error("Pick a preferred launch date");
      return;
    }

    if (!form.contact_email.trim() && !form.contact_x.trim()) {
      toast.error("Add an email or an X handle so we can reach you.");
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const response = await fetch("/api/launchpad/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          supply: Number(form.supply),
          company_website: honeypot,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const issues: { path?: unknown; message?: unknown }[] = Array.isArray(
          data?.details
        )
          ? data.details
          : [];
        const fieldErrors: Record<string, string> = {};

        for (const issue of issues) {
          const key =
            Array.isArray(issue?.path) && issue.path.length > 0
              ? String(issue.path[0])
              : "";
          if (key && !fieldErrors[key]) {
            fieldErrors[key] =
              typeof issue.message === "string"
                ? issue.message
                : "Invalid value";
          }
        }

        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          focusFirstError(fieldErrors);
          toast.error("Please fix the highlighted fields");
          return;
        }

        toast.error(data.error || "Could not send the request");
        return;
      }

      setRequestId(data.id);
      onSubmitted?.(data.id);
      toast.success("Request sent! We'll get back to you soon.");
    } catch (error) {
      console.error("Error submitting launchpad request:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (requestId) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="ui-container rounded-2xl p-8 text-center sm:p-12">
          <span className="material-symbols-outlined text-5xl text-emerald-700 dark:text-emerald-300">
            mark_email_read
          </span>
          <h3 className="mt-4 font-header text-2xl text-text-primary">
            Request received
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-blue">
            Thanks! Our team will review your collection details and reach out
            using the contact info you provided. You can keep this reference:
          </p>
          <p className="mt-4 inline-block rounded-lg border border-ink/10 bg-ink/[0.03] px-4 py-2 font-mono text-xs text-text-primary">
            {requestId}
          </p>
          <p className="mx-auto mt-3 max-w-md text-[11px] leading-5 text-muted-blue">
            Your current status is shown above. Keep this ID — you can paste it
            into “Check your request status” any time to see updates.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/launchpad"
              className="rounded-full bg-accent-warm px-6 py-3 text-xs font-bold uppercase tracking-widest text-background transition-all hover:brightness-110"
            >
              Back to launchpad
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      <form onSubmit={handleSubmit} className="ui-container rounded-2xl p-5 sm:p-8">
        <div className="mb-6">
          <p className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-iris">
            <span className="material-symbols-outlined text-base">send</span>
            Launch request
          </p>
          <h2 className="font-header text-3xl font-extrabold tracking-[-0.04em] text-ink">
            Tell us about your collection
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-ink-soft">
            We build the contract, mint page and launch schedule for approved
            projects on GIWA.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-iris/20 bg-iris/5 px-3 py-2 text-[11px] text-ink-mute">
            <span className="material-symbols-outlined text-sm text-iris">
              link
            </span>
            Launch chain:{" "}
            <span className="font-bold text-ink">GIWA Sepolia</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="collection_name" label="Collection name" required error={errors.collection_name}>
              <input
                required
                minLength={2}
                maxLength={120}
                value={form.collection_name}
                onChange={(event) => update("collection_name", event.target.value)}
                placeholder="Hollow Genesis"
                className={inputClass}
              />
            </Field>
            <Field name="symbol" label="Symbol" required hint="Letters and numbers only, e.g. HOLLOW" error={errors.symbol}>
              <input
                required
                minLength={2}
                maxLength={16}
                pattern="[A-Za-z0-9]+"
                value={form.symbol}
                onChange={(event) => update("symbol", event.target.value)}
                placeholder="HOLLOW"
                className={inputClass}
              />
            </Field>
          </div>

          <Field name="description" label="Description" required hint="At least 20 characters. What is the collection about?" error={errors.description}>
            <textarea
              required
              minLength={20}
              maxLength={2000}
              rows={4}
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="A collection of 1,000 hand-crafted characters living on GIWA…"
              className={inputClass}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="supply" label="Total supply" required error={errors.supply}>
              <input
                required
                type="number"
                min={1}
                max={1_000_000}
                step={1}
                value={form.supply}
                onChange={(event) => update("supply", event.target.value)}
                placeholder="1000"
                className={inputClass}
              />
            </Field>
            <Field name="mint_price" label="Mint price (ETH)" required hint="Use 0 for a free mint." error={errors.mint_price}>
              <input
                required
                value={form.mint_price}
                onChange={(event) => update("mint_price", event.target.value)}
                placeholder="0.01"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="launch_date" label="Preferred launch date" required error={errors.launch_date}>
              <DateTimePicker
                value={form.launch_date}
                onChange={(value) => update("launch_date", value)}
              />
            </Field>
            <Field name="creator_wallet" label="Creator wallet" hint="The wallet that should own or receive the collection." error={errors.creator_wallet}>
              <input
                value={form.creator_wallet}
                onChange={(event) => update("creator_wallet", event.target.value)}
                placeholder="0x…"
                className={`${inputClass} font-mono`}
              />
            </Field>
          </div>

          <div className="rounded-xl border border-ink/10 bg-ink/[0.02] p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-blue">
              Contact & links
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="contact_email" label="Email" error={errors.contact_email}>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(event) => update("contact_email", event.target.value)}
                  placeholder="you@project.xyz"
                  className={inputClass}
                />
              </Field>
              <Field name="contact_x" label="X handle" error={errors.contact_x}>
                <input
                  value={form.contact_x}
                  onChange={(event) => update("contact_x", event.target.value)}
                  placeholder="@yourproject"
                  className={inputClass}
                />
              </Field>
              <Field name="website_url" label="Website" hint="Links without https:// are assumed to be https." error={errors.website_url}>
                <input
                  value={form.website_url}
                  onChange={(event) => update("website_url", event.target.value)}
                  placeholder="https://yourproject.xyz"
                  className={inputClass}
                />
              </Field>
              <Field name="x_url" label="X / Twitter URL" error={errors.x_url}>
                <input
                  value={form.x_url}
                  onChange={(event) => update("x_url", event.target.value)}
                  placeholder="https://x.com/yourproject"
                  className={inputClass}
                />
              </Field>
              <Field name="discord_url" label="Discord URL" error={errors.discord_url}>
                <input
                  value={form.discord_url}
                  onChange={(event) => update("discord_url", event.target.value)}
                  placeholder="https://discord.gg/…"
                  className={inputClass}
                />
              </Field>
              <Field name="artwork_url" label="Artwork / logo URL" hint="PNG, JPG, GIF or IPFS gateway link." error={errors.artwork_url}>
                <input
                  value={form.artwork_url}
                  onChange={(event) => update("artwork_url", event.target.value)}
                  placeholder="https://…/artwork.png"
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          <Field name="notes" label="Anything else we should know?" error={errors.notes}>
            <textarea
              rows={3}
              maxLength={2000}
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="Royalties, allowlist plans, special mint mechanics…"
              className={inputClass}
            />
          </Field>

          {/* Honeypot — hidden from humans. */}
          <div className="hidden" aria-hidden="true">
            <label>
              Company website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
              />
            </label>
          </div>

          {!isConnected && (
            <div className="rounded-xl border border-iris/20 bg-iris/5 p-4">
              <p className="text-xs text-muted-blue">
                Connect a wallet to prefill your creator address. You can also
                type it manually.
              </p>
              <ConnectButton.Custom>
                {({ openConnectModal, mounted }) => {
                  if (!mounted) return null;
                  return (
                    <button
                      type="button"
                      onClick={openConnectModal}
                      className="mt-3 rounded-full bg-accent-warm px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-background transition-all hover:brightness-110"
                    >
                      Connect wallet
                    </button>
                  );
                }}
              </ConnectButton.Custom>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent-warm text-sm font-bold uppercase tracking-[0.15em] text-background transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <span className="material-symbols-outlined animate-spin text-xl">
                progress_activity
              </span>
            ) : (
              <span className="material-symbols-outlined text-xl">send</span>
            )}
            {submitting ? "Sending…" : "Submit launch request"}
          </button>
        </div>
      </form>

      {/* Sidebar */}
      <div className="space-y-4">
        <div className="ui-container rounded-2xl p-6">
          <h3 className="font-header text-lg text-text-primary">
            What happens next?
          </h3>
          <ol className="mt-4 space-y-4">
            {[
              {
                icon: "mark_email_read",
                title: "We review your request",
                text: "Our team checks the details and contacts you within a few days.",
              },
              {
                icon: "handshake",
                title: "We align on the launch",
                text: "Supply, mint price, schedule and artwork are confirmed together.",
              },
              {
                icon: "rocket_launch",
                title: "We deploy and launch",
                text: "We deploy the ERC-721 contract and publish your mint page on GIWA.",
              },
            ].map((step, index) => (
              <li key={step.icon} className="flex gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-iris/10 text-iris">
                  <span className="material-symbols-outlined text-lg">
                    {step.icon}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-text-primary">
                    {index + 1}. {step.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-blue">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="ui-container rounded-2xl p-6">
          <h3 className="font-header text-lg text-text-primary">
            What we need
          </h3>
          <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-muted-blue">
            {[
              "Collection name, symbol and description",
              "Total supply and mint price in ETH",
              "Preferred launch date",
              "Artwork or logo URL",
              "At least one contact method",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="material-symbols-outlined mt-0.5 text-sm text-emerald-700 dark:text-emerald-300">
                  check
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-iris/20 bg-iris/5 p-6">
          <p className="text-xs font-bold text-text-primary">
            Already have a launch scheduled?
          </p>
          <p className="mt-1 text-[11px] text-muted-blue">
            Head to the launchpad to mint the current collection.
          </p>
          <Link
            href="/launchpad"
            className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-iris hover:underline"
          >
            Go to launchpad
            <span className="material-symbols-outlined text-sm">
              arrow_forward
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
