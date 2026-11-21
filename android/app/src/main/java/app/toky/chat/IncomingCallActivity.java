package app.toky.chat;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

/**
 * Transparent trampoline launched by an incoming-call notification (its body /
 * full-screen intent, or the "Contestar" action). It turns the screen on and
 * shows OVER the lock screen, then brings the main app (the WebRTC call UI) to
 * the foreground.
 *
 * For "answer" it hands MainActivity a tokychat://call/answer deep link so the
 * web layer auto-accepts; for a plain "open" it just brings the app forward and
 * the web's incoming-call recovery shows the accept/decline screen.
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

        String action = getIntent().getStringExtra(TokyMessagingService.EXTRA_ACTION);
        String callId = getIntent().getStringExtra(TokyMessagingService.EXTRA_CALL_ID);
        boolean video = getIntent().getBooleanExtra(TokyMessagingService.EXTRA_VIDEO, false);

        // Bring the WebRTC app to the front; it shows the incoming-call screen.
        Intent main = new Intent(this, MainActivity.class);
        main.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        // "answer": hand the web a deep link so it auto-accepts this call.
        if ("answer".equals(action) && callId != null && !callId.isEmpty()) {
            Uri link = Uri.parse(
                "tokychat://call/answer?callId=" + Uri.encode(callId) + "&video=" + (video ? "1" : "0"));
            main.setAction(Intent.ACTION_VIEW);
            main.setData(link);
        }
        try {
            startActivity(main);
        } catch (Exception ignored) {
        }
        finish();
    }
}
