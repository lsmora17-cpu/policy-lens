import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.107.88.85"],
  // CHECK.md item 11: link secrecy is this app's only protection (CLAUDE.md —
  // no auth by design), so the secret URL must never leak via the Referer
  // header if a user clicks a link out of the app. Applied here (not
  // proxy.ts, which only matches /api/:path*) so it covers page routes too.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
