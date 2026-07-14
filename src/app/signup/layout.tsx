import type { Metadata } from "next";
import { APP } from "@/lib/config";

// signup/page.tsx is a client component; its unique title/description live
// here. This page is public and indexable (it's in the sitemap).
export const metadata: Metadata = {
  title: `Start your free ${APP.trialDays}-day trial — ${APP.name}`,
  description: `Create your ${APP.name} account and collect unlimited digital waivers for a flat $${APP.priceMonthlyUsd}/month. No credit card required to start.`,
  alternates: { canonical: "/signup" },
  openGraph: {
    title: `Start your free ${APP.trialDays}-day trial — ${APP.name}`,
    description: `Unlimited digital waivers for a flat $${APP.priceMonthlyUsd}/month. Free ${APP.trialDays}-day trial, no card required.`,
    url: "/signup",
  },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
