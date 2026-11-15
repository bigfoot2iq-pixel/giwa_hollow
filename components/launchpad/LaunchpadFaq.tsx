import { Plus, ShieldCheck } from "lucide-react";
import { formatCount, type MintValues } from "./launchpad-format";

export function LaunchpadFaq({
  values,
  symbol,
}: {
  values?: MintValues;
  symbol: string;
}) {
  const walletLimit =
    values && values.walletLimit > 0n
      ? `${formatCount(values.walletLimit)} per wallet`
      : "set by the collection";
  const supply =
    values && values.supply > 0n
      ? `${formatCount(values.supply)} pieces`
      : "a fixed supply";

  const faqs = [
    {
      question: "How do I mint?",
      answer:
        "Connect a wallet on GIWA Sepolia, choose how many pieces you want, and confirm the transaction. The contract mints immediately; the supply counters update as soon as GIWA confirms the block.",
    },
    {
      question: "When can I mint?",
      answer:
        "The public phase is a switch the collection owner controls on-chain. There is no end date: while the phase is open, the mint button works until the 2,222-piece supply runs out. When the owner closes it, the mint button locks again.",
    },
    {
      question: "Which network and currency do I need?",
      answer:
        `GIWA Sepolia (chain 91342). Gas and the mint price are paid in ETH. If your wallet is on another network, the mint panel offers to switch it to GIWA before submitting.`,
    },
    {
      question: "Why does the panel check holder balances?",
      answer:
        "Some drops ask for a minimum native-token balance on Ethereum Sepolia, Base Sepolia, Ink Sepolia, BNB Testnet, or GIWA Sepolia itself. The check is read-only: it never moves funds and never asks you to sign. If no requirements are configured, every wallet can mint.",
    },
    {
      question: "What is the maximum per wallet?",
      answer: `This drop allows ${walletLimit} across ${supply}. The contract is the final authority, so the counters in the mint panel always follow the on-chain rule.`,
    },
    {
      question: "Why did my transaction fail?",
      answer:
        "Common causes are a closed or sold-out mint, a wallet that already reached its limit, insufficient ETH for the price plus gas, or a wallet on the wrong network. The page surfaces the contract's reason so you can fix it before retrying.",
    },
    {
      question: "Where can I see my NFT after minting?",
      answer:
        "The confirmation card links straight to the transaction on GIWA Explorer. Once the collection metadata is indexed, the NFT appears in your wallet and in any compatible marketplace.",
    },
    {
      question: "Are mints refundable?",
      answer:
        `No. Blockchain transactions are final, and minting sends real ETH for the price and gas. Check the collection address on GIWA Explorer before you confirm.`,
    },
  ];

  return (
    <section
      id="launchpad-faq"
      aria-labelledby="launchpad-faq-heading"
      className="section-shell scroll-mt-28 pb-5 pt-5"
    >
      <div className="ui-container rounded-[30px] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/[0.07] pb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-full border border-iris/15 bg-iris/[0.06] text-iris">
              <ShieldCheck className="size-3.5" />
            </span>
            <h2
              id="launchpad-faq-heading"
              className="font-header text-base font-extrabold tracking-[-0.02em] text-ink"
            >
              Before you sign
            </h2>
          </div>
          <span className="pill">
            <span className="live-dot" />
            On-chain mint · {symbol}
          </span>
        </div>

        <div>
          {faqs.map((item) => (
            <details
              key={item.question}
              className="group border-b border-ink/[0.07] last:border-b-0"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 py-3.5 text-[12.5px] font-medium text-ink transition hover:text-iris">
                {item.question}
                <span className="accordion-plus inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-ink/10 font-mono text-[11px] leading-none text-ink-mute transition duration-300 group-hover:border-iris/30 group-hover:text-iris">
                  <Plus className="size-3" />
                </span>
              </summary>
              <p className="pb-4 pr-8 text-[11px] leading-6 text-ink-mute">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
