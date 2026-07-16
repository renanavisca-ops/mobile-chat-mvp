/** @type {import('next').NextConfig} */
const nextConfig = {
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

export default nextConfig;
