import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@/components/analytics";
import { Toaster } from "@/components/ui/sonner";
import { APP } from "@/lib/config";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `Unlimited Digital Waivers — $${APP.priceMonthlyUsd}/month Flat | ${APP.name}`,
  description:
    "Stop paying per signed waiver. Upload the PDF you already use — your digital waiver is live in 5 minutes.",
};

/**
 * Applies the theme before first paint: explicit cookie wins, otherwise
 * system preference. Inline + blocking so there is no flash, and the
 * marketing pages stay statically renderable (no cookies() on the server).
 */
const themeInitScript = `(function(){try{var m=document.cookie.match(/(?:^|; )fw-theme=(dark|light)/);var t=m?m[1]:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="bottom-right" />
        <Analytics />
      </body>
    </html>
  );
}
