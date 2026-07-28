# Sozialzync Mobile App

Native Android and iOS wrapper for the Sozialzync web app, built with [Capacitor](https://capacitorjs.com/).

## Architecture

```
Capacitor native shell
    └── WebView → https://sozialzync.vercel.app
```

The native app loads the live Vercel deployment inside a WebView. This means:
- No separate mobile build pipeline — the web app is the source of truth
- Auth (JWT cookies/localStorage) works identically to the browser
- All Vercel deployments are immediately available in the app without an app store update
- Native plugins (push notifications, camera, haptics) are added as a thin layer on top

## Prerequisites

### Android
- [Android Studio](https://developer.android.com/studio) Hedgehog or newer
- JDK 17 (`JAVA_HOME` must point to it)
- Android SDK Platform 34+
- Gradle 8+

### iOS (macOS only)
- Xcode 15+
- CocoaPods (`sudo gem install cocoapods`)
- Apple Developer account (for device testing / App Store distribution)

---

## First-time setup

```bash
cd apps/mobile
pnpm install
```

### Add Android platform
```bash
pnpm add:android
# Generates: apps/mobile/android/
```

### Add iOS platform (macOS only)
```bash
pnpm add:ios
# Generates: apps/mobile/ios/
```

---

## Development builds

### Android debug APK

```bash
pnpm build:android
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

Install on a connected device:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Open in Android Studio
```bash
pnpm open:android
```

### iOS debug build (macOS only)

```bash
pnpm build:ios
# Requires Xcode and valid provisioning profile
```

Open in Xcode:
```bash
pnpm open:ios
```

---

## Release builds

### Android release APK

1. Generate a keystore (one-time):
   ```bash
   keytool -genkey -v -keystore release.keystore \
     -alias sozialzync -keyalg RSA -keysize 2048 -validity 10000
   ```
   **Never commit `release.keystore` to git** (already in `.gitignore`).

2. Set env vars (or edit `android/app/build.gradle`):
   ```
   KEYSTORE_PASSWORD=...
   KEY_ALIAS=sozialzync
   KEY_PASSWORD=...
   ```

3. Build:
   ```bash
   pnpm build:android:release
   # Output: android/app/build/outputs/apk/release/app-release.apk
   ```

4. Upload to [Google Play Console](https://play.google.com/console).

### iOS App Store

1. In Xcode: set your Team, Bundle ID (`com.sozialzync.app`), and Signing Certificate.
2. Create an Archive: **Product → Archive**.
3. Distribute via **Xcode Organizer → Distribute App → App Store Connect**.
4. Submit for review in [App Store Connect](https://appstoreconnect.apple.com).

---

## Syncing web changes

After any change to the web app that you want reflected in native:
```bash
pnpm sync
# Runs: cap sync (copies web assets + updates native plugins)
```

Since the app loads from the live Vercel URL, most web changes are instant — `sync` is only needed when native plugin config changes.

---

## Native features roadmap

| Phase | Feature | Plugin |
|-------|---------|--------|
| 1 | Push notifications | `@capacitor/push-notifications` |
| 1 | Status bar theming | `@capacitor/status-bar` |
| 1 | Splash screen | `@capacitor/splash-screen` |
| 2 | Camera / media picker | `@capacitor/camera` |
| 2 | Share sheet | `@capacitor/share` |
| 2 | Haptic feedback | `@capacitor/haptics` |
| 3 | Offline caching | Service Worker + `@capacitor/preferences` |
| 3 | Background sync | `@capacitor-community/background-fetch` |

---

## OAuth / Auth in WebView

The app uses the same JWT tokens as the web (stored in `localStorage`). OAuth flows (Google, Apple) open via `@capacitor/browser` InAppBrowser, which shares the same cookie jar as the WebView. After OAuth redirect, the web app handles the callback at `/auth/*/callback` as normal.

For deep links (e.g. `sozialzync://auth/callback`), configure in:
- **Android**: `android/app/src/main/AndroidManifest.xml` → intent filter
- **iOS**: `ios/App/App/Info.plist` → URL scheme `sozialzync`

---

## CI/CD

See `.github/workflows/mobile-android.yml` for the automated Android debug build. The workflow triggers on pushes to `apps/mobile/**` and uploads the APK as an artifact.

For production releases, use [Fastlane](https://fastlane.tools/) or [Bitrise](https://bitrise.io/) with the keystore stored as a GitHub secret.
