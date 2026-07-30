package app.toky.chat;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * Foreground service that runs for the duration of a call.
 *
 * Without it, when the screen turns off Android backgrounds the app, revokes
 * microphone access from background processes, and lets the CPU sleep — which
 * killed calls the moment the screen locked. Running a microphone-typed
 * foreground service keeps mic access, and a partial wake lock keeps the CPU
 * awake, so the WebRTC connection survives with the screen off.
 */
public class CallForegroundService extends Service {
    private static final String CHANNEL_ID = "toky_calls";
    private static final int NOTIF_ID = 4711;
    private PowerManager.WakeLock wakeLock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannel();

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Toky Chat")
            .setContentText("Call in progress")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();

        int type = 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
        }
        ServiceCompat.startForeground(this, NOTIF_ID, notification, type);

        acquireWakeLock();
        return START_NOT_STICKY;
    }

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) return;
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "toky:call");
            // Safety cap so a missed stop can never pin the CPU forever.
            wakeLock.acquire(60 * 60 * 1000L);
        }
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {
            }
        }
        wakeLock = null;
        super.onDestroy();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Calls", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("Ongoing call");
                nm.createNotificationChannel(ch);
            }
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
