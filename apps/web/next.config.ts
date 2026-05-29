import type { NextConfig } from "next";
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\/api\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 32, maxAgeSeconds: 60 },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "image-cache",
        expiration: { maxEntries: 64, maxAgeSeconds: 86400 },
      },
    },
    {
      urlPattern: /\.(?:js|css)$/i,
      handler: "StaleWhileRevalidate",
      options: { cacheName: "static-cache" },
    },
    {
      urlPattern: /\/report\/.*/i,
      handler: "NetworkFirst",
      options: { cacheName: "report-cache", networkTimeoutSeconds: 10 },
    },
  ],
});

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: { allowedOrigins: ["*"] },
  },
};

// Only wrap with Sentry if DSN is configured — avoids build errors when not set up
const hasSentry = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

if (hasSentry) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { withSentryConfig } = require("@sentry/nextjs");
  module.exports = withSentryConfig(withPWA(nextConfig), {
    silent: true,
    disableLogger: true,
    automaticVercelMonitors: false,
  });
} else {
  module.exports = withPWA(nextConfig);
}
