package app.toky.chat;

import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioFocusRequest;
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

    /** True while a VIDEO call is in progress, so MainActivity can shrink into a
     *  floating Picture-in-Picture window (keeping the video visible) when the
     *  user leaves the app. Cleared when the call ends. */
    public static volatile boolean activeVideoCall = false;

    // Held VOICE_COMMUNICATION audio focus for the duration of the call. Like
    // every real VoIP app, we must OWN the audio session — otherwise another
    // audio event (e.g. MediaProjection starting when the user shares their
    // screen) can steal/reroute the mic and one side goes silent.
    private AudioFocusRequest focusRequest;
    private final AudioManager.OnAudioFocusChangeListener focusListener = focusChange -> {
        // A call manages its own audio via WebRTC; we intentionally keep going
        // through transient losses rather than ducking/pausing the call.
    };

    private AudioManager audioManager() {
        Context ctx = getContext();
        if (ctx == null) return null;
        return (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
    }

    /** Take (or re-take) a strong voice-call audio focus so the OS treats this
     *  as a phone call and keeps the mic/route stable for the whole session. */
    private void requestCallFocus(AudioManager am) {
        if (am == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attrs)
                .setOnAudioFocusChangeListener(focusListener)
                .setWillPauseWhenDucked(false)
                .build();
            am.requestAudioFocus(focusRequest);
        } else {
            am.requestAudioFocus(focusListener, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN);
        }
    }

    private void abandonCallFocus(AudioManager am) {
        if (am == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (focusRequest != null) {
                am.abandonAudioFocusRequest(focusRequest);
                focusRequest = null;
            }
        } else {
            am.abandonAudioFocus(focusListener);
        }
    }

    /** Re-assert the call audio session (mode + focus). The web calls this after
     *  starting screen share, since MediaProjection can knock the call's audio
     *  focus loose and mute one side. Cheap and idempotent. */
    @PluginMethod
    public void ensureCallAudio(PluginCall call) {
        AudioManager am = audioManager();
        if (am != null) {
            am.setMode(AudioManager.MODE_IN_COMMUNICATION);
            requestCallFocus(am);
        }
        call.resolve();
    }

    @PluginMethod
    public void startCallAudio(PluginCall call) {
        AudioManager am = audioManager();
        if (am == null) {
            call.reject("AudioManager unavailable");
            return;
        }
        am.setMode(AudioManager.MODE_IN_COMMUNICATION);
        requestCallFocus(am);
        boolean video = Boolean.TRUE.equals(call.getBoolean("video", false));
        activeVideoCall = video;
        try {
            Intent i = new Intent(getContext(), CallForegroundService.class);
            i.putExtra("video", video);
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

    /** Our generic output category for an AudioDeviceInfo type. */
    private static String categoryFor(int type) {
        switch (type) {
            case AudioDeviceInfo.TYPE_BUILTIN_EARPIECE: return "earpiece";
            case AudioDeviceInfo.TYPE_BUILTIN_SPEAKER: return "speaker";
            case AudioDeviceInfo.TYPE_WIRED_HEADSET:
            case AudioDeviceInfo.TYPE_WIRED_HEADPHONES:
            case AudioDeviceInfo.TYPE_USB_HEADSET: return "wired";
            case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:
            case AudioDeviceInfo.TYPE_BLE_HEADSET: return "bluetooth";
            default: return "other";
        }
    }

    /** List the available call audio outputs (category + whether it's active). */
    @PluginMethod
    public void listOutputs(PluginCall call) {
        AudioManager am = audioManager();
        com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
        JSObject ret = new JSObject();
        if (am == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            // Pre-12 we can't enumerate reliably; expose the two we can toggle.
            if (am != null) {
                JSObject ear = new JSObject(); ear.put("type", "earpiece"); arr.put(ear);
                JSObject spk = new JSObject(); spk.put("type", "speaker"); arr.put(spk);
            }
            ret.put("outputs", arr);
            call.resolve(ret);
            return;
        }
        AudioDeviceInfo active = am.getCommunicationDevice();
        String activeCat = active != null ? categoryFor(active.getType()) : null;
        java.util.HashSet<String> seen = new java.util.HashSet<>();
        for (AudioDeviceInfo d : am.getAvailableCommunicationDevices()) {
            String cat = categoryFor(d.getType());
            if ("other".equals(cat) || seen.contains(cat)) continue;
            seen.add(cat);
            JSObject o = new JSObject();
            o.put("type", cat);
            o.put("active", cat.equals(activeCat));
            arr.put(o);
        }
        ret.put("outputs", arr);
        call.resolve(ret);
    }

    /** Route call audio to the given output category. */
    @PluginMethod
    public void setOutput(PluginCall call) {
        String target = call.getString("type", "earpiece");
        AudioManager am = audioManager();
        if (am == null) { call.reject("AudioManager unavailable"); return; }
        am.setMode(AudioManager.MODE_IN_COMMUNICATION);
        boolean ok = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AudioDeviceInfo match = null;
            for (AudioDeviceInfo d : am.getAvailableCommunicationDevices()) {
                if (categoryFor(d.getType()).equals(target)) { match = d; break; }
            }
            if (match != null) ok = am.setCommunicationDevice(match);
        } else {
            if ("speaker".equals(target)) { am.setSpeakerphoneOn(true); ok = am.isSpeakerphoneOn(); }
            else if ("bluetooth".equals(target)) { try { am.startBluetoothSco(); am.setBluetoothScoOn(true); ok = true; } catch (Exception ignored) {} }
            else { am.setSpeakerphoneOn(false); try { am.setBluetoothScoOn(false); am.stopBluetoothSco(); } catch (Exception ignored) {} ok = true; }
        }
        JSObject ret = new JSObject();
        ret.put("ok", ok);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopCallAudio(PluginCall call) {
        activeVideoCall = false;
        AudioManager am = audioManager();
        if (am != null) {
            abandonCallFocus(am);
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
