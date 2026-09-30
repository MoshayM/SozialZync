# SozialZynk Mobile App — Build Guide

The app is a Capacitor wrapper that loads the live web app.
No static export needed — always shows the latest version.

---

## Android APK (Windows or Mac)

### Requirements
- [Android Studio](https://developer.android.com/studio) installed
- Java 17+ (bundled with Android Studio)

### Steps
```bash
cd apps/mobile

# 1. Open in Android Studio
npx cap open android

# 2. In Android Studio:
#    Build → Generate Signed Bundle/APK → APK
#    Choose a keystore (create one if first time)
#    Build → assembleRelease

# OR build from terminal:
cd android
./gradlew assembleDebug        # debug APK (for testing)
./gradlew bundleRelease        # .aab for Google Play Store
```

Debug APK is at: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## iOS App (Mac only)

### Requirements
- Mac with Xcode 15+
- Apple Developer account ($99/year for distribution)

### Steps
```bash
cd apps/mobile

# 1. Add iOS platform (Mac only)
npx cap add ios

# 2. Apply Info.plist permissions from ios-permissions.md

# 3. Open in Xcode
npx cap open ios

# 4. In Xcode:
#    Select your signing team
#    Product → Archive → Distribute App
```

---

## Updating the App

Since the app loads the live Vercel URL, most updates are automatic.
Only run these if you change capacitor.config.ts or add native plugins:

```bash
npx cap sync
```
