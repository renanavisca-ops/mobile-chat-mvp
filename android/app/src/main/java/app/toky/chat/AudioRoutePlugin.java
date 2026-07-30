package app.toky.chat;

import android.content.Context;
import android.media.AudioManager;

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
 * AudioManager directly:
 *
 *   - startCallAudio(): switch to MODE_IN_COMMUNICATION (the mode WebRTC voice
 *     calls expect) so routing + echo cancellation behave correctly.
 *   - setSpeakerphoneOn({on}): toggle the loudspeaker.
 *   - stopCallAudio(): restore MODE_NORMAL and turn the loudspeaker off when the
 *     call ends, so the phone goes back to its normal audio state.
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
        // Ensure we're in the communication mode before routing.
        am.setMode(AudioManager.MODE_IN_COMMUNICATION);
        am.setSpeakerphoneOn(on);
        JSObject ret = new JSObject();
        ret.put("on", am.isSpeakerphoneOn());
        call.resolve(ret);
    }

    @PluginMethod
    public void stopCallAudio(PluginCall call) {
        AudioManager am = audioManager();
        if (am != null) {
            am.setSpeakerphoneOn(false);
            am.setMode(AudioManager.MODE_NORMAL);
        }
        call.resolve();
    }
}
