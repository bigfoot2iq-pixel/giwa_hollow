/**
 * Small network marks for the holder gate. They are deliberately drawn at
 * 20px and sit on a paper chip, so four requirements can read in one glance.
 */
export function ChainIcon({ chain }: { chain: string }) {
  const iconClass = "h-3 w-3";
  const wrapperClass =
    "flex size-5 shrink-0 items-center justify-center rounded-md border border-ink/[0.08] bg-paper";

  switch (chain) {
    case "ethereum":
      return (
        <span aria-hidden="true" className={wrapperClass}>
          <svg viewBox="0 0 24 24" className={iconClass} fill="#627EEA" focusable="false">
            <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z" />
          </svg>
        </span>
      );

    case "base":
      return (
        <span aria-hidden="true" className={wrapperClass}>
          <svg viewBox="0 0 1280 1280" className={iconClass} fill="#0052FF" focusable="false">
            <path d="M0,101.12c0-34.64,0-51.95,6.53-65.28,6.25-12.76,16.56-23.07,29.32-29.32C49.17,0,66.48,0,101.12,0h1077.76c34.63,0,51.96,0,65.28,6.53,12.75,6.25,23.06,16.56,29.32,29.32,6.52,13.32,6.52,30.64,6.52,65.28v1077.76c0,34.63,0,51.96-6.52,65.28-6.26,12.75-16.57,23.06-29.32,29.32-13.32,6.52-30.65,6.52-65.28,6.52H101.12c-34.64,0-51.95,0-65.28-6.52-12.76-6.26-23.07-16.57-29.32-29.32-6.53-13.32-6.53-30.65-6.53-65.28V101.12Z" />
          </svg>
        </span>
      );

    case "ink":
      return (
        <span aria-hidden="true" className={wrapperClass}>
          <svg viewBox="0 0 36 36" className={iconClass} fill="#7132F5" focusable="false">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M36 18C36 8.05887 27.9411 0 18 0 8.05887 0 0 8.05887 0 18s8.05887 18 18 18 18-8.05887 18-18ZM20.5691 31.4715c0 1.2211-1.0022 2.2137-2.4248 2.2422a18.03 18.03 0 0 1-.1184.0006h-.0518C9.30723 33.7003 2.28571 26.6701 2.28571 18 2.28571 9.32127 9.32124 2.28574 18 2.28574c.0468 0 .0935.00021.1402.00062 1.6054.02859 2.4289 1.02112 2.4289 2.24216 0 1.24273-1.0985 2.1572-2.2624 2.1572-1.1638 0-1.221.00002-2.335.0893-1.1141.08927-2.2661 1.00374-2.2661 2.24279 0 1.24641 1.0125 2.25011 2.2661 2.25011h9.8802c1.2499 0 2.2624 1.0038 2.2624 2.2428 0 1.2391-1.0125 2.2428-2.2624 2.2428H10.6337c-1.25356 0-2.26605 1.0075-2.26605 2.2502 0 1.239 1.01249 2.2428 2.26605 2.2428h7.673c1.2499 0 2.2624 1.0037 2.2624 2.2465 0 1.239-1.0125 2.2428-2.2624 2.2428h-2.335c-1.2536 0-2.2661 1.0037-2.2661 2.2427 0 1.2428 1.0377 2.1499 2.2661 2.2428.0968.0074.1853.0141.2669.0203.4323.033.6685.051.905.0608.2849.0119.5702.0119 1.1993.0119 1.2498 0 2.2262.9181 2.2262 2.1572Z"
            />
          </svg>
        </span>
      );

    case "bnb":
      return (
        <span aria-hidden="true" className={wrapperClass}>
          <svg viewBox="0 0 24 24" className={iconClass} fill="#F0B90B" focusable="false">
            <path d="M5.631 3.676 12.001 0l6.367 3.676-2.34 1.358L12 2.716 7.972 5.034l-2.34-1.358Zm12.737 4.636-2.34-1.358L12 9.272 7.972 6.954l-2.34 1.358v2.716l4.026 2.318v4.636L12 19.341l2.341-1.359v-4.636l4.027-2.318V8.312Zm0 7.352v-2.716l-2.34 1.358v2.716l2.34-1.358Zm1.663.96-4.027 2.318v2.717l6.368-3.677V10.63l-2.34 1.358v4.636Zm-2.34-10.63 2.34 1.358v2.716l2.341-1.358V5.994l-2.34-1.358-2.342 1.358ZM9.657 19.926v2.716L12 24l2.341-1.358v-2.716l-2.34 1.358-2.343-1.358Zm-4.027-4.262 2.341 1.358v-2.716l-2.34-1.358v2.716Zm4.027-9.67L12 7.352l2.341-1.358-2.34-1.358-2.343 1.358Zm-5.69 1.358L6.31 5.994 3.968 4.636l-2.34 1.358V8.71l2.34 1.358V7.352Zm0 4.636-2.34-1.358v7.352l6.368 3.677v-2.717l-4.028-2.318v-4.636Z" />
          </svg>
        </span>
      );

    default:
      return (
        <span
          aria-hidden="true"
          className={`${wrapperClass} font-mono text-[7px] font-bold uppercase text-ink-mute`}
        >
          {chain.slice(0, 3)}
        </span>
      );
  }
}
