package app.toky.chat;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;

import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Screen sharing for Android calls. The WebView's Chromium has no
 * getDisplayMedia, so this plugin:
 *   1. asks the user for MediaProjection consent (system dialog),
 *   2. starts ScreenCaptureService (a mediaProjection foreground service), and
 *   3. relays the service's JPEG frames to JS via the "frame" event.
 *
 * JS (native-screen.ts) paints those frames onto a canvas and uses
 * canvas.captureStream() as the outgoing screen track — so the existing WebRTC
 * call code needs no change.
 */
@CapacitorPlugin(name = "ScreenShare")
public class ScreenSharePlugin extends Plugin {

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", true); // native path exists on Android
        call.resolve(ret);
    }

    @PluginMethod
    public void start(PluginCall call) {
        Context ctx = getContext();
        MediaProjectionManager mpm =
            (MediaProjectionManager) ctx.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (mpm == null) {
            call.reject("MediaProjection unavailable");
            return;
        }
        Intent intent = mpm.createScreenCaptureIntent();
        startActivityForResult(call, intent, "screenCaptureResult");
    }

    @ActivityCallback
    private void screenCaptureResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("cancelled");
            return;
        }
        // Stream the service's frames out through the plugin's "frame" event.
        ScreenCaptureService.setListener(new ScreenCaptureService.FrameListener() {
            @Override
            public void onFrame(String base64Jpeg, int width, int height) {
                JSObject ev = new JSObject();
                ev.put("data", base64Jpeg);
                ev.put("width", width);
                ev.put("height", height);
                notifyListeners("frame", ev);
            }

            @Override
            public void onStopped() {
                notifyListeners("stopped", new JSObject());
            }
        });

        Intent svc = new Intent(getContext(), ScreenCaptureService.class);
        svc.putExtra("resultCode", result.getResultCode());
        svc.putExtra("data", result.getData());
        try {
            ContextCompat.startForegroundService(getContext(), svc);
        } catch (Exception e) {
            ScreenCaptureService.setListener(null);
            call.reject("Could not start screen capture: " + e.getMessage());
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        ScreenCaptureService.setListener(null);
        try {
            Intent svc = new Intent(getContext(), ScreenCaptureService.class);
            getContext().stopService(svc);
        } catch (Exception ignored) {
        }
        call.resolve();
    }
}
