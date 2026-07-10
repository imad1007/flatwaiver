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

const SITE_DESCRIPTION =
  "Stop paying per signed waiver. Upload the PDF you already use — your digital waiver is live in 5 minutes.";

export const metadata: Metadata = {
  metadataBase: new URL(APP.url || "http://localhost:3000"),
  title: `Unlimited Digital Waivers — $${APP.priceMonthlyUsd}/month Flat | ${APP.name}`,
  description: SITE_DESCRIPTION,
  // "./" resolves per-route, so every page canonicalizes its own clean URL
  // (strips ?utm_/gclid duplicates from ads).
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    siteName: APP.name,
    title: `Unlimited Digital Waivers — $${APP.priceMonthlyUsd}/month Flat`,
    description: SITE_DESCRIPTION,
    url: "./",
  },
  twitter: {
    card: "summary_large_image",
    title: `Unlimited Digital Waivers — $${APP.priceMonthlyUsd}/month Flat`,
    description: SITE_DESCRIPTION,
  },
};

/**
 * Applies the theme before first paint. Light is the default for everyone;
 * dark applies only after the user explicitly picks it via the in-app toggle
 * (fw-theme cookie) — system preference is deliberately ignored. Inline +
 * blocking so there is no flash, and the marketing pages stay statically
 * renderable (no cookies() on the server).
 */
const themeInitScript = `(function(){try{var m=document.cookie.match(/(?:^|; )fw-theme=(dark|light)/);if(m&&m[1]==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

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
