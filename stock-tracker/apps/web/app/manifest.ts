import type { MetadataRoute } from "next";

// Web App Manifest → served at /manifest.webmanifest (Next auto-links it in
// <head>). Makes the site installable as a standalone PWA: "홈 화면에 추가"
// on Android Chrome installs a WebAPK with our icon; iOS Safari uses the
// apple-touch-icon + apple-web-app metadata in layout.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stock Tracker — 스윙 콘솔",
    short_name: "스윙콘솔",
    description:
      "2x 레버리지 ETF 스윙 트레이딩 콘솔 — 시장 레짐 · 섹터 자금 흐름 · 포지션 처방",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0b0d12",
    theme_color: "#0b0d12",
    categories: ["finance"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
