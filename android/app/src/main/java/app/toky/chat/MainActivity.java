package app.toky.chat;

import android.app.PictureInPictureParams;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** True while the app is in the foreground, so an incoming-call push rings
     *  in-app (web UI) instead of also posting the native full-screen notification. */
    public static volatile boolean isForeground = false;

    // Capacitor's BridgeActivity declares onResume()/onPause() as public, so the
    // overrides must be public too (a protected override is "weaker access").
    @Override
    public void onResume() {
        super.onResume();
        isForeground = true;
    }

    @Override
    public void onPause() {
        super.onPause();
        isForeground = false;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must be registered before super.onCreate() so the bridge picks it up.
        registerPlugin(AudioRoutePlugin.class);
        registerPlugin(ScreenSharePlugin.class);
        registerPlugin(PrintPlugin.class);
        registerPlugin(ScreenSecurityPlugin.class);
        super.onCreate(savedInstanceState);
    }

    /**
     * When the user leaves the app DURING a video call (home button / recents),
     * shrink into a floating Picture-in-Picture window so the call video keeps
     * showing (like WhatsApp), instead of the app going fully to the background.
     * Only for an active video call; a voice call / no call just backgrounds.
     */
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && AudioRoutePlugin.activeVideoCall) {
            try {
                // A less extreme (3:4) portrait ratio makes the floating window a
                // bit larger than a tall-narrow 9:16, which felt too small.
                PictureInPictureParams params = new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(3, 4))
                    .build();
                enterPictureInPictureMode(params);
            } catch (Exception ignored) {
                // PiP unsupported or not allowed right now — fall back to normal background.
            }
        }
    }
}
