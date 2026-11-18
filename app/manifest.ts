import type { MetadataRoute } from "next"

/**
 * The installable Studio (served at /studio/manifest.webmanifest because of basePath). Scope and
 * start URL are the studio only, so the installed window never covers the rest of art.jabrod.com.
 * Icons: public/icons/ (the Jabrod mark in cream on the studio's near-black).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/studio",
    name: "Jabrod Art Studio",
    short_name: "Studio",
    description: "Chat, images, video and voice on one canvas, and the JBD editor. By Jabrod.",
    start_url: "/studio",
    scope: "/studio",
    display: "standalone",
    background_color: "#0a090c",
    theme_color: "#0a090c",
    icons: [
      { src: "/studio/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/studio/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/studio/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
