package app.toky.chat;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.WindowManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

/**
 * Foreground service that captures the device screen with the MediaProjection
 * API and streams downscaled JPEG frames to JS, where they're painted onto a
 * canvas whose captureStream() feeds the existing WebRTC peer connection (see
 * native-screen.ts). This is what makes "share my screen" work inside the
 * Capacitor WebView on Android — the WebView's Chromium has no getDisplayMedia,
 * so we bridge frames ourselves.
 *
 * Frames are intentionally throttled and downscaled: this is for "let me show
 * you my screen so you can help", not full-motion video. The bridge can't carry
 * 30fps full-resolution bitmaps, so we target a modest size + frame rate.
 */
public class ScreenCaptureService extends Service {
    private static final String CHANNEL_ID = "toky_screen_share";
    private static final int NOTIF_ID = 4713;

    // Tuning: keep the bridge payload small. ~5 fps at ~540px wide, JPEG q40.
    private static final int TARGET_WIDTH = 540;
    private static final long MIN_FRAME_INTERVAL_MS = 200; // ~5 fps
    private static final int JPEG_QUALITY = 40;

    /** JS-facing callback, set by ScreenSharePlugin while a session is active. */
    public interface FrameListener {
        void onFrame(String base64Jpeg, int width, int height);
        void onStopped();
    }

    @Nullable
    private static volatile FrameListener listener;

    public static void setListener(@Nullable FrameListener l) {
        listener = l;
    }

    private MediaProjection projection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private HandlerThread thread;
    private Handler handler;
    private long lastFrameAt = 0;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannel();
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Toky Chat")
            .setContentText("Sharing your screen")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();

        int type = 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION;
        }
        // On Android 14+ the FGS must be running (with the mediaProjection type)
        // BEFORE MediaProjection is obtained, so start it first.
        ServiceCompat.startForeground(this, NOTIF_ID, notification, type);

        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        int resultCode = intent.getIntExtra("resultCode", 0);
        Intent data = intent.getParcelableExtra("data");
        if (resultCode == 0 || data == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        MediaProjectionManager mpm =
            (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (mpm == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        projection = mpm.getMediaProjection(resultCode, data);
        if (projection == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        // A registered callback is required on Android 14+.
        projection.registerCallback(new MediaProjection.Callback() {
            @Override
            public void onStop() {
                teardown();
            }
        }, null);

        startCapture();
        return START_NOT_STICKY;
    }

    private void startCapture() {
        DisplayMetrics metrics = new DisplayMetrics();
        WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        if (wm != null) wm.getDefaultDisplay().getRealMetrics(metrics);
        final int srcW = metrics.widthPixels > 0 ? metrics.widthPixels : 1080;
        final int srcH = metrics.heightPixels > 0 ? metrics.heightPixels : 1920;
        final int dpi = metrics.densityDpi > 0 ? metrics.densityDpi : 320;

        // Capture at a downscaled size to keep frames small; preserve aspect.
        final float scale = Math.min(1f, (float) TARGET_WIDTH / srcW);
        final int capW = Math.max(2, Math.round(srcW * scale) & ~1); // even dims
        final int capH = Math.max(2, Math.round(srcH * scale) & ~1);

        thread = new HandlerThread("toky-screencap");
        thread.start();
        handler = new Handler(thread.getLooper());

        imageReader = ImageReader.newInstance(capW, capH, PixelFormat.RGBA_8888, 2);
        imageReader.setOnImageAvailableListener(reader -> {
            Image image = null;
            try {
                image = reader.acquireLatestImage();
                if (image == null) return;
                long now = System.currentTimeMillis();
                if (now - lastFrameAt < MIN_FRAME_INTERVAL_MS) return;
                lastFrameAt = now;
                emitFrame(image, capW, capH);
            } catch (Throwable ignored) {
                // Never let a bad frame crash the capture thread.
            } finally {
                if (image != null) image.close();
            }
        }, handler);

        virtualDisplay = projection.createVirtualDisplay(
            "toky-screen",
            capW, capH, dpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader.getSurface(),
            null, handler);
    }

    private void emitFrame(Image image, int capW, int capH) {
        FrameListener l = listener;
        if (l == null) return;
        Image.Plane[] planes = image.getPlanes();
        if (planes.length == 0) return;
        ByteBuffer buffer = planes[0].getBuffer();
        int pixelStride = planes[0].getPixelStride();
        int rowStride = planes[0].getRowStride();
        int rowPadding = rowStride - pixelStride * capW;
        int bmpW = capW + (pixelStride > 0 ? rowPadding / pixelStride : 0);

        Bitmap bitmap = Bitmap.createBitmap(bmpW, capH, Bitmap.Config.ARGB_8888);
        bitmap.copyPixelsFromBuffer(buffer);
        Bitmap out = bitmap;
        if (bmpW != capW) {
            out = Bitmap.createBitmap(bitmap, 0, 0, capW, capH);
            bitmap.recycle();
        }
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        out.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, baos);
        out.recycle();
        String b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
        l.onFrame(b64, capW, capH);
    }

    private void teardown() {
        try {
            if (virtualDisplay != null) virtualDisplay.release();
        } catch (Throwable ignored) {}
        virtualDisplay = null;
        try {
            if (imageReader != null) imageReader.close();
        } catch (Throwable ignored) {}
        imageReader = null;
        try {
            if (projection != null) projection.stop();
        } catch (Throwable ignored) {}
        projection = null;
        if (thread != null) {
            thread.quitSafely();
            thread = null;
        }
        FrameListener l = listener;
        if (l != null) l.onStopped();
    }

    @Override
    public void onDestroy() {
        teardown();
        super.onDestroy();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Screen sharing", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("Active while you share your screen");
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
