package app.toky.chat;

import android.content.Context;
import android.content.Intent;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Native audio routing for WebRTC calls.
 *
 * Android's WebView routes call audio to the earpiece by default and does not
 * support HTMLMediaElement.setSinkId, so the web-only speaker toggle could
 * never actually enable the loudspeaker. This plugin drives the platform
 * AudioManager directly and runs a foreground service for the call:
 *
 *   - startCallAudio(): MODE_IN_COMMUNICATION + start CallForegroundService so
 *     the call survives the screen turning off (keeps mic access + a wake lock).
 *   - setSpeakerphoneOn({on}): toggle the loudspeaker. Uses the modern
 *     setCommunicationDevice API on Android 12+ (the old setSpeakerphoneOn is
 *     deprecated there and often a no-op), falling back on older devices.
 *   - stopCallAudio(): stop the service and restore MODE_NORMAL.
 */
@CapacitorPlugin(name = "AudioRoute")
public class AudioRoutePlugin extends Plugin {

    private AudioManager audioManager() {
        Context ctx = getContext();
        if (ctx == null) return null;
        return (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
    }

    @PluginMethod
    public void startCallAudio(PluginCall call) {
        AudioManager am = audioManager();
        if (am == null) {
            call.reject("AudioManager unavailable");
            return;
        }
        am.setMode(AudioManager.MODE_IN_COMMUNICATION);
        try {
            Intent i = new Intent(getContext(), CallForegroundService.class);
            ContextCompat.startForegroundService(getContext(), i);
        } catch (Exception ignored) {
            // If the service can't start, the call still works while foregrounded.
        }
        call.resolve();
    }

    @PluginMethod
    public void setSpeakerphoneOn(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        AudioManager am = audioManager();
        if (am == null) {
            call.reject("AudioManager unavailable");
            return;
        }
        am.setMode(AudioManager.MODE_IN_COMMUNICATION);

        boolean effective = on;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (on) {
                AudioDeviceInfo speaker = null;
                for (AudioDeviceInfo d : am.getAvailableCommunicationDevices()) {
                    if (d.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) {
                        speaker = d;
                        break;
                    }
                }
                effective = speaker != null && am.setCommunicationDevice(speaker);
            } else {
                am.clearCommunicationDevice();
                effective = false;
            }
        } else {
            am.setSpeakerphoneOn(on);
            effective = am.isSpeakerphoneOn();
        }

        JSObject ret = new JSObject();
        ret.put("on", effective);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopCallAudio(PluginCall call) {
        AudioManager am = audioManager();
        if (am != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                am.clearCommunicationDevice();
            } else {
                am.setSpeakerphoneOn(false);
            }
            am.setMode(AudioManager.MODE_NORMAL);
        }
        try {
            Intent i = new Intent(getContext(), CallForegroundService.class);
            getContext().stopService(i);
        } catch (Exception ignored) {
        }
        call.resolve();
    }
}
