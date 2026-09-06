import { APP } from "@/lib/config";

export const SUPPORT_FAQS: {
  q: string;
  a: string;
  link?: { href: string; label: string };
}[] = [
  {
    q: "How do I set up my first waiver?",
    a: `Upload the waiver you already use — a PDF, a photo, or a Word file — and ${APP.name} converts it into a signable digital form, preserving your wording. You review every clause, publish it, and share it as a link, a printable QR code, or on a front-desk kiosk. Most owners are collecting signatures the same afternoon.`,
  },
  {
    q: "How does signing work for minors and guardians?",
    a: "When a participant is under 18, they check the “participant is under 18” box during signing. The waiver then collects the parent or guardian's full legal name, their relationship to the minor, and a separate guardian signature — all stored on the signed record alongside the participant's details. (Whether a parent can waive a child's own claims varies by state; ask your lawyer.)",
    link: {
      href: "/blog/are-digital-waivers-legally-binding",
      label: "More on minors and enforceability",
    },
  },
  {
    q: "Are the signed waivers legally binding?",
    a: `Electronic signatures collected through ${APP.name} are recognized in the United States under the federal ESIGN Act and UETA. Every signature captures the signer's affirmative consent, the exact waiver text they saw, a timestamp, and a tamper-evident record. This isn't legal advice — the enforceability of your wording depends on your state, so have a lawyer review your waiver text.`,
    link: {
      href: "/blog/are-digital-waivers-legally-binding",
      label: "What makes a digital waiver enforceable",
    },
  },
  {
    q: "How do I find a specific signed waiver?",
    a: "Open the Signatures page in your dashboard and search by the signer's name. You can also filter by date range, by which waiver they signed, or show only flagged records (for example, a disclosed medical condition). Every result opens to the full signed PDF and its evidence details.",
  },
  {
    q: "Can I export my signed waivers?",
    a: "Yes. From the Signatures page you can export a CSV of every record and download the signed PDFs in bulk. Export is never locked behind your subscription — your legal documents are yours, so even if you cancel you can still download everything.",
  },
  {
    q: "How do I cancel, and what happens to my waivers?",
    a: "You can cancel any time from Settings → Billing. Cancelling only pauses new signatures — every waiver you've already collected stays viewable, searchable, and downloadable. We never hold your legal records hostage.",
  },
  {
    q: "How much does it cost?",
    a: `${APP.name} is a flat $${APP.priceMonthlyUsd}/month for unlimited signed waivers, unlimited templates, and unlimited storage — no per-waiver fees and no volume tiers. It starts with a ${APP.trialDays}-day free trial, and no credit card is required to try it.`,
    link: { href: "/#pricing", label: "See pricing" },
  },
  {
    q: "How is my data kept secure?",
    a: "All data is encrypted in transit and at rest. Each signed waiver is rendered once and stamped with a SHA-256 integrity hash, records are append-only so they can't be silently edited, and every organization's data is isolated at the database level. It's built to hold up as a system of record.",
    link: { href: "/security", label: "How we keep records court-ready" },
  },
];

