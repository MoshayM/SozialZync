import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sozialzync.app',
  appName: 'Sozialzynk',
  webDir: 'dist',
  server: {
    // Live server mode: loads the Vercel deployment inside the native WebView.
    // Remove this block to switch to bundled/offline mode (requires static export).
    url: 'https://sozialzync.vercel.app',
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
