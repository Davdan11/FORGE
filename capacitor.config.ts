import type { CapacitorConfig } from "@capacitor/cli";

/* One source, three products.

   `webDir` points at the static export Next writes with BUILD_TARGET=native —
   the iOS and Android apps are that folder running inside a native WebView,
   so a change to a React component reaches all three targets at once.

   What the native shells add is the part a browser will not give us:
   Bluetooth for trainers and heart-rate straps (Safari has none, at all),
   GPS that keeps recording with the screen off, and notifications the system
   delivers rather than a tab that has been discarded. Those are also what
   keep the App Store from treating this as a repackaged website, which its
   guidelines reject. */
const config: CapacitorConfig = {
  // Reverse-DNS, and it is permanent: once an app ships under this id it
  // cannot be changed without becoming a different app. Worth choosing a
  // domain you actually control before the first submission.
  appId: "ca.danjou.forge",
  appName: "FORGE",
  webDir: "out",
  ios: {
    // The app is dark at the edges; a white bounce looks like a bug.
    backgroundColor: "#0a0a0a",
    contentInset: "always",
  },
  android: {
    backgroundColor: "#0a0a0a",
  },
};

export default config;
