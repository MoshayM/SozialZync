# Mobile App — Architecture & Build Guide

## Overview

Sozialzync ships a native mobile app for Android and iOS using [Capacitor](https://capacitorjs.com/). The app is a thin native shell that loads the production web app (`https://sozialzync.vercel.app`) inside a WebView.

**Source**: `apps/mobile/`  
**App ID**: `com.sozialzync.app`  
**App Name**: Sozialzynk

---

## Architecture

```
┌─────────────────────────────────┐
│  Native Shell (Capacitor)        │
│  ┌───────────────────────────┐  │
│  │  WebView                   │  │
│  │  https://sozialzync.vercel │  │
│  │  .app                      │  │
│  └───────────────────────────┘  │
│  Native Plugins:                 │
│  • Push Notifications           │
│  • Status Bar / Splash          │
│  • Haptics / Keyboard           │
└─────────────────────────────────┘
```

### Why Capacitor + Vercel URL (not React Native)?

| Consideration | Capacitor WebView | React Native rewrite |
|--------------|-------------------|----------------------|
| Time to ship | Days | Months |
| Code sharing | 100% (single codebase) | ~0% (separate RN codebase) |
| Web deployment lag | None (live URL) | App store review per release |
| Native feel | Good (PWA-grade) | Excellent |
| Plugin ecosystem | Capacitor plugins | React Native libraries |
| Offline support | Via Service Worker | Native |

For the current stage, the Capacitor approach ships immediately while preserving the option to migrate to React Native later.

---

## Authentication in WebView

JWT tokens are stored in `localStorage` on the `sozialzync.vercel.app` origin. The WebView shares the same storage as a browser session on that domain, so login state persists across app restarts.

**OAuth flows** (Google, Apple) are handled via `@capacitor/browser` InAppBrowser:
1. Web app opens OAuth URL in InAppBrowser
2. Provider redirects to `https://sozialzync.vercel.app/auth/<provider>/callback`
3. WebView resumes with the session cookie set
4. No deep link configuration needed for the basic flow

**Deep links** for custom URL scheme (`sozialzync://`):
- Android: add intent filter to `AndroidManifest.xml` for `sozialzync` scheme
- iOS: add URL scheme entry to `Info.plist` under `CFBundleURLTypes`

---

## Native Features Roadmap

### Phase 1 — Already configured
- **Push Notifications** (`@capacitor/push-notifications`): FCM (Android) + APNs (iOS)
- **Status Bar** (`@capacitor/status-bar`): matches brand purple `#7C3AED`
- **Splash Screen** (`@capacitor/splash-screen`): 2-second branded splash

To enable push notifications, register FCM/APNs tokens server-side and call the `/notifications` API when a token is received.

### Phase 2 — Media & sharing
- **Camera / Media Picker** (`@capacitor/camera`): native file picker for video upload
- **Share** (`@capacitor/share`): share generated clips to other apps
- **Haptics** (`@capacitor/haptics`): feedback on publish/approve actions

### Phase 3 — Offline & background
- **Offline caching**: Service Worker already runs in WebView; extend for key pages
- **Background Fetch** (`@capacitor-community/background-fetch`): sync jobs while app is backgrounded
- **Preferences** (`@capacitor/preferences`): store user prefs natively

---

## Android — Signing & Release

### Generate keystore (one-time, keep secure)
```bash
keytool -genkey -v \
  -keystore apps/mobile/release.keystore \
  -alias sozialzync \
  -keyalg RSA -keysize 2048 \
  -validity 10000
```
Store the keystore and passwords in your secrets manager (e.g. 1Password, GitHub Secrets). **Never commit the keystore file.**

### Build release APK
```bash
cd apps/mobile
pnpm build:android:release
```

### Upload to Google Play
1. Go to [Google Play Console](https://play.google.com/console)
2. Create app → package name `com.sozialzync.app`
3. Upload APK/AAB under **Production → Create new release**
4. Complete store listing (screenshots, description, privacy policy)

### CI release signing
Store as GitHub repository secrets:
- `ANDROID_KEYSTORE_BASE64` — base64-encoded keystore file
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS` = `sozialzync`
- `ANDROID_KEY_PASSWORD`

Decode in the workflow step before building:
```yaml
- name: Decode keystore
  run: echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > apps/mobile/release.keystore
  env:
    ANDROID_KEYSTORE_BASE64: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}
```

---

## iOS — Signing & App Store

### Requirements
- macOS with Xcode 15+
- CocoaPods: `sudo gem install cocoapods`
- Apple Developer Program membership ($99/year)

### Build
```bash
cd apps/mobile
pnpm add:ios        # first time only
pnpm open:ios       # opens Xcode
```

In Xcode:
1. Set Team (your Apple Developer account)
2. Set Bundle Identifier: `com.sozialzync.app`
3. **Product → Archive**
4. **Distribute → App Store Connect**

### App Store Connect
1. Create app at [App Store Connect](https://appstoreconnect.apple.com)
2. Bundle ID: `com.sozialzync.app`
3. Upload build from Xcode Organizer
4. Complete metadata (screenshots for iPhone 6.7", 6.1", iPad 12.9")
5. Submit for review

---

## CI/CD

The workflow `.github/workflows/mobile-android.yml` automatically builds a debug APK on every push to `apps/mobile/**` on master. The APK is uploaded as a GitHub Actions artifact (retained for 14 days).

For production release automation, consider:
- [Fastlane](https://fastlane.tools/) with `fastlane supply` (Android) and `fastlane deliver` (iOS)
- [Bitrise](https://bitrise.io/) for macOS CI (iOS signing requires macOS runners)
- GitHub Actions with macOS runner for iOS (more expensive)

---

## Local Development

To test against a local API instead of production:

1. Edit `apps/mobile/capacitor.config.ts`:
   ```ts
   server: {
     url: 'http://10.0.2.2:3007',  // Android emulator host IP for localhost
     // url: 'http://localhost:3007', // iOS simulator
   }
   ```

2. Sync and rebuild: `pnpm sync && pnpm build:android`

The web app at `apps/web/` runs on port 3007 in dev mode (`pnpm dev`).
