import type { Metadata } from "next";
import "./globals.css";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { Web3Provider } from "@/components/providers";
import { Header, Sidebar } from "@/components/layout";
import { GlobalLoader } from "@/components/ui/GlobalLoader";
import { GiwaAmbientBackground } from "@/components/ui/GiwaAmbientBackground";
import { Toaster } from "sonner";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const materialSymbols = localFont({
  src: "../public/fonts/material-symbols-outlined.woff2",
  variable: "--font-material-symbols",
  display: "swap",
  weight: "100 700",
});

export const metadata: Metadata = {
  title: "Ariwa - Win Crypto Prizes",
  description: "Decentralized raffles platform on GIWA Sepolia. Enter raffles, win prizes!",
  icons: {
    icon: "/giwa/logo-letter.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${spaceGrotesk.variable} ${materialSymbols.variable}`}>
      <head />
      <body className="antialiased min-h-screen">
        <GiwaAmbientBackground />
        <GlobalLoader />
        <Toaster
          theme="light"
          toastOptions={{
            style: {
              background: "#ffffff",
              border: "1px solid rgba(0, 98, 223, 0.2)",
              color: "#1a2434",
            },
          }}
        />
        <Web3Provider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto w-full">
              <Header />
              <div className="max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8">
                {children}
              </div>
            </main>
          </div>
        </Web3Provider>
      </body>
    </html>
  );
}
