package app.toky.chat;

import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Screenshot / screen-recording protection. When enabled, sets FLAG_SECURE on
 * the activity window so Android blocks screenshots and shows a black frame in
 * screen recordings and the recent-apps thumbnail. Disabling clears the flag.
 *
 * Android-only: iOS has no equivalent API to block screenshots, so there is no
 * iOS counterpart (the web layer treats it as unavailable there).
 */
@CapacitorPlugin(name = "ScreenSecurity")
public class ScreenSecurityPlugin extends Plugin {

    @PluginMethod
    public void setSecure(final PluginCall call) {
        final boolean enabled = call.getBoolean("enabled", false);
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (enabled) {
                        getActivity().getWindow().setFlags(
                            WindowManager.LayoutParams.FLAG_SECURE,
                            WindowManager.LayoutParams.FLAG_SECURE
                        );
                    } else {
                        getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    }
                    call.resolve();
                } catch (Exception e) {
                    call.reject("setSecure failed: " + e.getMessage());
                }
            }
        });
    }
}
