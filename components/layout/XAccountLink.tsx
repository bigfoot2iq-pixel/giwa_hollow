import Image from "next/image";
import { cn } from "@/lib/utils/cn";

const X_URL = "https://x.com/ARIWA_on_Giwa";

/**
 * The header's link to the collection's X account.
 *
 * X is the only other brand on the site, but the pill wears ARIWA's own iris
 * instead of X's blue: the same violet gradient the primary buttons use, with a
 * soft white bloom at the top-left so it stays dimensional against the warm
 * cream header without fighting the collection's palette.
 *
 * The collection's icon leads the pill and carries the verified badge on its
 * shoulder, the way X itself shows it. The badge keeps its official blue but is
 * ringed in paper white, because a blue mark against the violet needs the
 * profile frame to separate it from the button.
 */
export function XAccountLink({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <a
      href={X_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="ARIWA on X, verified account"
      className={cn(
        "x-account group/x inline-flex h-11 shrink-0 items-center gap-2.5 rounded-full pl-2 pr-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris-soft/80 focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
        className,
      )}
    >
      <span className="relative shrink-0">
        <span className="relative block size-[30px] overflow-hidden rounded-full ring-2 ring-paper">
          <Image
            src="/brand/ariwa-icon.webp"
            alt=""
            width={30}
            height={30}
            className="size-full object-cover"
          />
        </span>
        <span
          className="absolute -bottom-[2px] -right-[2px] grid place-items-center"
          aria-hidden="true"
        >
          <VerifiedBadge className="x-account-badge size-[12px] rounded-full" />
        </span>
      </span>

      <span
        className={cn("x-account-label", showLabel ? "inline" : "hidden xl:inline")}
      >
        ARIWA
      </span>

      <XLogo className="size-[15px] shrink-0 text-white/90 transition-transform duration-300 group-hover/x:scale-110" />
    </a>
  );
}

/**
 * Official X (formerly Twitter) logo mark, kept as a single SVG path so it
 * renders sharply and inherits the surrounding text colour.
 */
export function XLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/**
 * X's verified-account badge, drawn as a single path so it stays crisp at
 * header sizes. Uses currentColor so callers can tint it.
 */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 22 22"
      fill="currentColor"
      role="img"
      aria-label="Verified account"
      focusable="false"
      className={className}
    >
      <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
    </svg>
  );
}
