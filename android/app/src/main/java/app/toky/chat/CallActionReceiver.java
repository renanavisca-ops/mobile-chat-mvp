package app.toky.chat;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.google.firebase.messaging.FirebaseMessaging;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

import org.json.JSONObject;

/**
 * Handles the "Rechazar" (decline) action on the full-screen incoming-call
 * notification when the app is killed/backgrounded.
 *
 * It clears the ringing notification immediately, then — authenticated by this
 * device's FCM token — tells the server to notify the caller so the call is
 * rejected instantly (not left ringing until timeout). The server verifies the
 * token belongs to the call's callee before acting.
 */
public class CallActionReceiver extends BroadcastReceiver {
    private static final String DECLINE_URL = "https://mobile-chat-mvp.vercel.app/api/push/call/decline";

    @Override
    public void onReceive(Context context, Intent intent) {
        // Stop the ring on this device right away.
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(TokyMessagingService.CALL_NOTIF_ID);

        final String callId = intent.getStringExtra(TokyMessagingService.EXTRA_CALL_ID);
        if (callId == null || callId.isEmpty()) return;

        // Network + token lookup must outlive onReceive(): keep the process alive.
        final PendingResult pending = goAsync();
        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                final String deviceToken = task.isSuccessful() ? task.getResult() : null;
                new Thread(() -> {
                    try {
                        if (deviceToken != null && !deviceToken.isEmpty()) {
                            postDecline(callId, deviceToken);
                        }
                    } catch (Exception ignored) {
                        // Best-effort: the ring is already cleared locally.
                    } finally {
                        pending.finish();
                    }
                }).start();
            });
        } catch (Exception e) {
            pending.finish();
        }
    }

    private void postDecline(String callId, String deviceToken) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(DECLINE_URL);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");

            JSONObject body = new JSONObject();
            body.put("callId", callId);
            body.put("deviceToken", deviceToken);

            byte[] out = body.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(out);
            }
            conn.getResponseCode(); // fire the request; response body is unused
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
