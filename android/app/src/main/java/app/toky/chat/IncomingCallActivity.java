package app.toky.chat;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

/**
 * Transparent trampoline launched by an incoming-call notification's full-screen
 * intent. It turns the screen on and shows OVER the lock screen, then brings the
 * main app (the WebRTC call UI) to the foreground so the user can answer — the
 * web layer detects the still-ringing call on open and shows accept/decline.
 */
public class IncomingCallActivity extends Activity {
    // Keep in sync with TokyMessagingService.CALL_NOTIF_ID.
    private static final int CALL_NOTIF_ID = 7411;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        // The user is engaging the call — clear the ringing notification.
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(CALL_NOTIF_ID);

        // Bring the WebRTC app to the front; it shows the incoming-call screen.
        Intent main = new Intent(this, MainActivity.class);
        main.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        try {
            startActivity(main);
        } catch (Exception ignored) {
        }
        finish();
    }
}
