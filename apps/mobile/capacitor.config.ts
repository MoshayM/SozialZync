import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sozialzynk.app',
  appName: 'SozialZynk',
  webDir: 'www',
  server: {
    url: 'https://sozialzynk.vercel.app',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'always',
    scrollEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      backgroundColor: '#374151',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      launchAutoHide: true,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#374151',
    },
  },
};

export default config;
