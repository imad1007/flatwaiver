import { ImageResponse } from "next/og";
import { getRenderablePost } from "@/lib/blog-merge";
import { APP } from "@/lib/config";

export const runtime = "nodejs";
export const alt = "FlatWaiver blog post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Per-post social card, matching the site-wide OG image's brand look. */
export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getRenderablePost(slug);
  const title = post?.title ?? `${APP.name} blog`;
  // Long titles get a smaller size so they never clip.
  const fontSize = title.length > 70 ? 44 : title.length > 45 ? 52 : 60;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 96px",
          background: "#101014",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 2.9h10c1.2 0 2.1.9 2.1 2.1v6.3c0 4.9-2.9 8.2-6.6 10.2-.3.2-.7.2-1 0-3.7-2-6.6-5.3-6.6-10.2V5c0-1.2.9-2.1 2.1-2.1Z"
              fill="#6366F1"
            />
            <path
              d="m8.4 11.9 2.4 2.4 4.8-5"
              stroke="#fff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>
            <span>Flat</span>
            <span style={{ color: "#818CF8" }}>Waiver</span>
          </div>
          <div
            style={{
              display: "flex",
              marginLeft: 8,
              padding: "6px 16px",
              borderRadius: 999,
              border: "1px solid #3f3f46",
              color: "#a1a1aa",
              fontSize: 24,
            }}
          >
            Blog
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            maxWidth: 1000,
          }}
        >
          {title}
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#9CA3AF" }}>
          Unlimited digital waivers · ${APP.priceMonthlyUsd}/month, flat ·
          flatwaiver.com
        </div>
      </div>
    ),
    size
  );
}
