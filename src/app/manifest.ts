import type { MetadataRoute } from "next";

// What the phone needs to install the app to the home screen and open it like a native one.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Calories Counter",
    short_name: "Calories",
    description: "Track the calories you eat each day.",
    lang: "en-AU",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
