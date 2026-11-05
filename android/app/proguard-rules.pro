# ProGuard / R8 rules for Toky Chat (release build, minifyEnabled true).
#
# Capacitor discovers and invokes plugins by reflection (class + method
# annotations, JS bridge), and our own native plugins/services are referenced
# by name, so they must NOT be stripped or renamed. These rules keep the
# framework, every plugin, and our native code; everything else is shrunk and
# obfuscated normally, which also produces the deobfuscation mapping that Play
# asks for (embedded in the .aab automatically).

# --- Capacitor framework & bridge (reflection-driven) ---
-keep public class * extends com.getcapacitor.Plugin
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.plugin.** { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
}

# Cordova plumbing that Capacitor still relies on
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# --- Our own native plugins & foreground services (loaded via the bridge) ---
# AudioRoutePlugin, ScreenSecurityPlugin, ScreenSharePlugin, PrintPlugin,
# CallForegroundService, ScreenCaptureService, MainActivity.
-keep class app.toky.chat.** { *; }

# --- WebView JavaScript interface (named methods called from JS) ---
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- Attributes Capacitor reads by reflection + readable crash reports ---
# SourceFile/LineNumberTable + the uploaded mapping = de-obfuscated stacktraces.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# --- Firebase Cloud Messaging (push) ---
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# --- Capacitor plugins pulled in as AARs ship their own consumer rules, which
#     AGP merges automatically. These keeps cover the ones we use directly. ---
-keep class com.getcapacitor.community.** { *; }
-dontwarn com.getcapacitor.community.**
