"use client";

import { useEffect } from "react";

// Registers the service worker (once, client-side) so the app satisfies
// Chrome's installability criteria. Failures are non-fatal (e.g. localhost
// without HTTPS, or unsupported browsers) — the app works regardless.
export default function RegisterSW() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore — SW is a progressive enhancement, not required to run */
      });
    }
  }, []);
  return null;
}
