import type { CapacitorConfig } from '@capacitor/cli';

// v1.2 — fixed CI to use pre-installed Android SDK (no android-actions/setup-android)
const config: CapacitorConfig = {
  appId: 'com.sozialzync.app',
  appName: 'Sozialzynk',
  webDir: 'dist',
  server: {
    // Live server mode: loads the Vercel deployment inside the native WebView.
    // Remove this block to switch to bundled/offline mode (requires static export).
    url: 'https://sozialzynk.vercel.app',
    cleartext: false,
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#7C3AED',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#7C3AED',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    allowMixedContent: false,
    buildOptions: {
      keystorePath: 'release.keystore',
      keystoreAlias: 'sozialzync',
    },
  },
  ios: {
    scheme: 'Sozialzynk',
    contentInset: 'always',
  },
};

export default config;
