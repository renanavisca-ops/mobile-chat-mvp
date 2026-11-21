package app.toky.chat;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Handles the "Rechazar" (decline) action on the full-screen incoming-call
 * notification. It clears the ringing notification immediately so the phone
 * stops ringing without opening the app.
 *
 * Note: this is a LOCAL dismissal — it stops the ring on THIS device. The caller
 * sees "no answer" when the call times out. (Notifying the caller instantly from
 * a killed app would need an authenticated network call from here; declining
 * from inside the open app already notifies the caller over realtime.)
 */
public class CallActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(TokyMessagingService.CALL_NOTIF_ID);
    }
}
