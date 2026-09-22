import type { NextConfig } from "next";

/* The same source builds three things.

   `npm run build`         — the web app, deployed normally.
   `BUILD_TARGET=native`   — a folder of static files with no server at all,
                             which is what Capacitor wraps into the iOS and
                             Android apps.

   The native build is gated behind an env var rather than made the default,
   because `output: "export"` silently removes capabilities from the web
   build too, and the web build should not be paying for the phones. */
const native = process.env.BUILD_TARGET === "native";

const nextConfig: NextConfig = {
  ...(native
    ? {
        output: "export",
        // There is no image optimiser inside a WebView; the loader would try
        // to call a server that is not there.
        images: { unoptimized: true },
        // A file:// WebView resolves /about as a directory, so every route
        // needs to be a folder with an index.html in it.
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
