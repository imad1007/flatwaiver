import type { Metadata } from "next";
import { APP } from "@/lib/config";

// login/page.tsx is a client component, so its noindex directive lives here.
// The login screen is a utility page — keep it out of the index.
export const metadata: Metadata = {
  title: `Log in — ${APP.name}`,
  robots: { index: false, follow: false },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
