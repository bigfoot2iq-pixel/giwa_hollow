import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Bricolage_Grotesque, DM_Sans, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Web3Provider } from "@/components/providers";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/providers/ThemeProvider";
import { ThemeToaster } from "@/components/providers/ThemeToaster";
import { SiteFooter, SiteHeader } from "@/components/layout";
import { GlobalLoader } from "@/components/ui/GlobalLoader";
import { GiwaAmbientBackground } from "@/components/ui/GiwaAmbientBackground";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

// Display face for the collection identity. Bricolage carries the plush,
// illustrated confidence of the residents without the usual web3 gloss.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const materialSymbols = localFont({
  src: "../public/fonts/material-symbols-outlined.woff2",
  variable: "--font-material-symbols",
  display: "swap",
  weight: "100 700",
  // This is a ~1.1 MB icon font. Preloading it competes with the real
  // above-the-fold assets (and used to gate the loader overlay). Icons swap in
  // a moment later, which is invisible next to the LCP win.
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://www.ariwa.xyz",
  ),
  title: {
    default: "ARIWA — The First PFP Collection on GIWA",
    template: "%s · ARIWA",
  },
  description:
    "The first PFP NFT collection on GIWA, featuring 2,222 unique NFTs. ARIWA brings NFTs, token trading, community rewards, and NFT launches into one ecosystem.",
  applicationName: "ARIWA",
  keywords: [
    "ARIWA",
    "GIWA",
    "GIWA Sepolia",
    "NFT collection",
    "PFP collection",
    "NFT launchpad",
    "token trading",
  ],
  authors: [{ name: "ARIWA" }],
  creator: "ARIWA",
  openGraph: {
    type: "website",
    siteName: "ARIWA",
    title: "ARIWA — The First PFP Collection on GIWA",
    description:
      "2,222 unique NFTs on GIWA. Trade the token and launch a collection in one ecosystem.",
    images: ["/art/nft/1.webp"],
  },
  twitter: {
    card: "summary_large_image",
    site: "@ARIWA_on_Giwa",
    creator: "@ARIWA_on_Giwa",
    title: "ARIWA — The First PFP Collection on GIWA",
    description:
      "2,222 unique NFTs on GIWA. Trade the token and launch a collection in one ecosystem.",
    images: ["/art/nft/1.webp"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF7EF" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a11" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${geistMono.variable} ${bricolage.variable} ${materialSymbols.variable}`}
    >
      <head>
        {/* Applies the stored theme before the first paint, so a dark-mode
            visitor never sees a flash of cream. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="relative flex min-h-screen flex-col antialiased">
        <ThemeProvider>
          <GiwaAmbientBackground />
          <div className="site-grain" aria-hidden="true" />
          <GlobalLoader />
          <ThemeToaster />
          <Web3Provider>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </Web3Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
