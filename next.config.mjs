import { withSentryConfig } from '@sentry/nextjs';

// MOBILE_EXPORT=1 switches the build into a static export (`out/`) for bundling
// inside the Capacitor Android/iOS app. The normal (unset) build is unchanged:
// a full Next.js server build with API routes, deployed to Vercel.
//
// In export mode we also drop the Sentry wrapper — its tunnel route
// (`/monitoring`) is a server route handler that can't exist in a static
// export. The hosted web build keeps Sentry exactly as before.
const isMobileExport = process.env.MOBILE_EXPORT === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isMobileExport
    ? {
        output: 'export',
        // No Next.js image optimization server exists in a bundled app.
        images: { unoptimized: true },
        // Emit `route/index.html` so directory-style paths resolve to a file
        // when the WebView performs a hard load of a sub-route.
        trailingSlash: true,
      }
    : {}),
  // Enables src/instrumentation.ts so Sentry initialises for the server/edge
  // runtimes (stable in Next 15; flagged in Next 14).
  experimental: {
    instrumentationHook: true,
  },
  webpack: (config, { isServer }) => {
    // In client bundles, Node core modules like "fs" do not exist.
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
        crypto: false,
      };
    }
    // @capacitor-firebase/messaging's web implementation imports the optional
    // `firebase/messaging` peer. We only use the plugin natively (the web impl
    // is lazy-loaded and gated behind isNativeApp()), so stub that import out
    // instead of pulling the whole Firebase web SDK into the build.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'firebase/messaging': false,
    };
    return config;
  },
};

// Only wrap with Sentry's build plugin when a DSN is configured AND this isn't a
// static mobile export, so unconfigured builds (local dev, forks) and the mobile
// export are completely unaffected. Source-map upload additionally requires
// SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN; without them the plugin simply
// skips the upload step.
export default process.env.NEXT_PUBLIC_SENTRY_DSN && !isMobileExport
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      // Route Sentry requests through the app's own origin so ad/tracker
      // blockers inside mobile WebViews don't drop error reports.
      tunnelRoute: '/monitoring',
      widenClientFileUpload: true,
      disableLogger: true,
    })
  : nextConfig;
