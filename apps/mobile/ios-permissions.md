# iOS Info.plist Permission Strings

Add these keys to `ios/App/App/Info.plist` after running `npx cap add ios` on a Mac:

```xml
<key>NSCameraUsageDescription</key>
<string>SozialZynk uses your camera to record videos for your content.</string>

<key>NSMicrophoneUsageDescription</key>
<string>SozialZynk uses your microphone to record audio for your videos.</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>SozialZynk saves your recordings to your photo library.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>SozialZynk accesses your photo library to import media into the editor.</string>
```
