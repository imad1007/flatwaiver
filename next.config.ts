import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
    ],
  },
  // The per-post OG image route reads content/blog/*.mdx via fs at request
  // time; computed paths aren't picked up by output file tracing, so include
  // them explicitly for every blog route (keys are picomatch route globs).
  outputFileTracingIncludes: {
    "/blog/**": ["./content/blog/*.mdx"],
  },
};

export default nextConfig;
