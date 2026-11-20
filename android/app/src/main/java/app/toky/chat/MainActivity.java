package app.toky.chat;

import android.app.PictureInPictureParams;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
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
                PictureInPictureParams params = new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(9, 16))
                    .build();
                enterPictureInPictureMode(params);
            } catch (Exception ignored) {
                // PiP unsupported or not allowed right now — fall back to normal background.
            }
        }
    }
}
