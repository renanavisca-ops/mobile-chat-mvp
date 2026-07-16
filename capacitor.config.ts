import type { CapacitorConfig } from '@capacitor/cli';

// Toky ships as a thin native shell (mobile/www) that boots into the live
// Next.js app hosted on Vercel. Because the app is server-rendered (App Router
// + API routes), we do NOT bundle the web build; the shell navigates to the
// hosted origin, which is whitelisted via server.allowNavigation so it stays
// in-app. This keeps store binaries tiny and lets web updates ship instantly
// without an app-store review.
const REMOTE_HOST = 'mobile-chat-mvp.vercel.app';

const config: CapacitorConfig = {
  appId: 'app.toky.chat',
  appName: 'Toky Chat',
  webDir: 'mobile/www',
  backgroundColor: '#020617',
  server: {
    androidScheme: 'https',
    // The hosted app + anything it needs to navigate to stays inside the shell.
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
