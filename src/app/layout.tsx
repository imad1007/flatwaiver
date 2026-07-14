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

/** Only the real production deploy is indexable; every preview is noindex. */
const IS_PRODUCTION = process.env.VERCEL_ENV === "production";

export const metadata: Metadata = {
  // Hardcoded www so all canonical/OG URLs resolve to the one true host,
  // never a preview deployment's URL.
  metadataBase: new URL(APP.siteUrl),
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
  // Belt-and-suspenders: noindex the entire site on any non-production
  // environment (preview / development), on top of the disallow-all robots.txt.
  ...(IS_PRODUCTION ? {} : { robots: { index: false, follow: false } }),
  // Rendered only when the env var is set; verify via DNS instead and this
  // stays inert.
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
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
