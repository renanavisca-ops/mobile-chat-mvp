import type { CapacitorConfig } from '@capacitor/cli';

// Self-contained app: the UI is BUNDLED (see scripts/build-mobile.mjs, which
// exports the app into `mobile/www`) and served from the secure local origin
// `https://localhost` (androidScheme 'https'), so Web Crypto / service-worker /
// media APIs keep working. The app no longer loads its interface from the live
// Vercel URL — it only calls the hosted backend for data (Supabase, Cloudflare,
// and the app's own /api/* routes via NEXT_PUBLIC_API_BASE_URL).
const config: CapacitorConfig = {
  appId: 'app.toky.chat',
  appName: 'Toky Chat',
  webDir: 'mobile/www',
  backgroundColor: '#020617',
  server: {
    // No `url`: load the bundled assets locally instead of the remote site.
    androidScheme: 'https', // serve bundled UI from https://localhost (secure context)
    iosScheme: 'https',
  },
  ios: {
    // Let media (WebRTC calls) play without a user gesture requirement.
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#020617',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    // Native push runs through @capacitor-firebase/messaging (FCM). It reads the
    // Firebase config files (google-services.json / GoogleService-Info.plist);
    // no extra Capacitor config is required here. See MOBILE.md.
  },
};

export default config;
