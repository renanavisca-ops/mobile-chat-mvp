import type { CapacitorConfig } from '@capacitor/cli';

// Toky runs the live Next.js app hosted on Vercel. We load it via server.url
// (not a JS redirect from a local page): that makes the hosted origin the app's
// own origin, so Capacitor injects its native bridge there and native plugins
// — Firebase push, splash, etc. — actually work. mobile/www stays as the build
// webDir / offline fallback. Web updates still ship instantly via Vercel.
const REMOTE_HOST = 'mobile-chat-mvp.vercel.app';

const config: CapacitorConfig = {
  appId: 'app.toky.chat',
  appName: 'Toky Chat',
  webDir: 'mobile/www',
  backgroundColor: '#020617',
  server: {
    url: `https://${REMOTE_HOST}`,
    androidScheme: 'https',
    // Keep navigations to the hosted app in-app (with the native bridge active).
    allowNavigation: [REMOTE_HOST],
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
