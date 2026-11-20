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
 * message we build a full-screen, ringing notification (WhatsApp-style) so the
 * phone rings and the call shows over the lock screen even when the app is
 * killed. Everything else falls through to the plugin (normal notifications +
 * JS delivery via super).
 */
public class TokyMessagingService extends MessagingService {
    private static final String CALL_CHANNEL = "incoming_calls";
    // Keep in sync with IncomingCallActivity.CALL_NOTIF_ID.
    private static final int CALL_NOTIF_ID = 7411;

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        // Ring natively only when the app is NOT already foreground; otherwise the
        // in-app web UI handles the ring via realtime, so we avoid double-ringing.
        if (data != null && "incoming_call".equals(data.get("type")) && !MainActivity.isForeground) {
            showIncomingCall(data);
            return;
        }
        super.onMessageReceived(remoteMessage);
    }

    private void showIncomingCall(Map<String, String> data) {
        String callerName = data.get("callerName");
        if (callerName == null || callerName.isEmpty()) callerName = "Llamada entrante";
        boolean video = "1".equals(data.get("video"));
        String text = video ? "📹 Videollamada entrante" : "📞 Llamada entrante";

        createChannel();

        Intent fsIntent = new Intent(this, IncomingCallActivity.class);
        fsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) piFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent fsPi = PendingIntent.getActivity(this, 0, fsIntent, piFlags);

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CALL_CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(callerName)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(true)
            .setContentIntent(fsPi)
            .setFullScreenIntent(fsPi, true);

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
