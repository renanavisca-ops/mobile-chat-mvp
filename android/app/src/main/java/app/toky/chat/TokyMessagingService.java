package app.toky.chat;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

import io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService;

/**
 * Extends the Firebase messaging plugin's service. For an "incoming_call" DATA
 * message we build a full-screen, ringing notification (WhatsApp-style) with
 * Answer/Decline actions, so the phone rings and the call shows over the lock
 * screen even when the app is killed. A "call_cancelled" DATA message clears it
 * (answered/declined/cancelled on another device). Everything else falls through
 * to the plugin (normal notifications + JS delivery via super).
 */
public class TokyMessagingService extends MessagingService {
    private static final String CALL_CHANNEL = "incoming_calls";
    // Keep in sync with IncomingCallActivity.CALL_NOTIF_ID / CallActionReceiver.
    static final int CALL_NOTIF_ID = 7411;
    // Extra keys shared with IncomingCallActivity / CallActionReceiver.
    static final String EXTRA_ACTION = "toky_action";
    static final String EXTRA_CALL_ID = "toky_callId";
    static final String EXTRA_VIDEO = "toky_video";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        if (data != null) {
            String type = data.get("type");
            // Call answered/declined/cancelled elsewhere — clear the ring here.
            if ("call_cancelled".equals(type)) {
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) nm.cancel(CALL_NOTIF_ID);
                return;
            }
            // Ring natively only when the app is NOT already foreground; otherwise
            // the in-app web UI rings via realtime, so we avoid double-ringing.
            if ("incoming_call".equals(type) && !MainActivity.isForeground) {
                showIncomingCall(data);
                return;
            }
        }
        super.onMessageReceived(remoteMessage);
    }

    private void showIncomingCall(Map<String, String> data) {
        String callerName = data.get("callerName");
        if (callerName == null || callerName.isEmpty()) callerName = "Llamada entrante";
        boolean video = "1".equals(data.get("video"));
        String callId = data.get("callId");
        if (callId == null) callId = "";
        String text = video ? "📹 Videollamada entrante" : "📞 Llamada entrante";

        createChannel();

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) piFlags |= PendingIntent.FLAG_IMMUTABLE;

        // Body tap / full-screen: open the app on the incoming-call screen.
        Intent openIntent = new Intent(this, IncomingCallActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            .putExtra(EXTRA_ACTION, "open")
            .putExtra(EXTRA_CALL_ID, callId)
            .putExtra(EXTRA_VIDEO, video);
        PendingIntent openPi = PendingIntent.getActivity(this, 0, openIntent, piFlags);

        // Answer: open the app and auto-accept this call (via a deep link).
        Intent answerIntent = new Intent(this, IncomingCallActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            .putExtra(EXTRA_ACTION, "answer")
            .putExtra(EXTRA_CALL_ID, callId)
            .putExtra(EXTRA_VIDEO, video);
        PendingIntent answerPi = PendingIntent.getActivity(this, 1, answerIntent, piFlags);

        // Decline: clear the ring locally (handled by a lightweight receiver).
        Intent declineIntent = new Intent(this, CallActionReceiver.class)
            .setAction("app.toky.chat.DECLINE")
            .putExtra(EXTRA_CALL_ID, callId);
        PendingIntent declinePi = PendingIntent.getBroadcast(this, 2, declineIntent, piFlags);

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CALL_CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(callerName)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(true)
            .setContentIntent(openPi)
            .setFullScreenIntent(openPi, true)
            .addAction(0, "Rechazar", declinePi)
            .addAction(0, "Contestar", answerPi);

        // Pre-Oreo devices have no channels, so set the ringtone on the builder.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            b.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE));
            b.setVibrate(new long[]{0, 1000, 1000, 1000, 1000});
        }

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(CALL_NOTIF_ID, b.build());
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CALL_CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(
            CALL_CHANNEL, "Llamadas entrantes", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Timbre de llamadas entrantes");
        Uri ring = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        if (ring != null) ch.setSound(ring, attrs);
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 1000, 1000, 1000, 1000});
        ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }
}
