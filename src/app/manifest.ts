import type { MetadataRoute } from "next";
import { APP } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP.name,
    short_name: APP.name,
    start_url: "/",
    display: "browser",
    icons: [
      { src: "/icons/flatwaiver-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/flatwaiver-logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
