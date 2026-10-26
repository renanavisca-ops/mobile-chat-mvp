package app.toky.chat;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.util.Base64;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Native printing via the Android print framework (PrintManager).
 *
 * A stock Capacitor WebView can't drive the OS printer from window.print(), so
 * "Print" used to fall back to sharing the file. This plugin opens the real
 * Android print dialog — with the list of available printers, "Save as PDF",
 * copies, paper size and orientation — for two kinds of input:
 *
 *   - printHtml({html}): rendered content (an image wrapped in HTML, or a parsed
 *     spreadsheet / Word document). We load it into an offscreen WebView and
 *     print that via WebView.createPrintDocumentAdapter.
 *   - printPdf({base64}): a PDF we already hold; streamed straight to the print
 *     framework by a PrintDocumentAdapter, so it prints exactly as-is.
 */
@CapacitorPlugin(name = "TokyPrint")
public class PrintPlugin extends Plugin {

    // Hold a strong reference so the offscreen WebView isn't garbage-collected
    // while the print job is still reading from its document adapter.
    private WebView printWebView;

    @PluginMethod
    public void printHtml(final PluginCall call) {
        final String html = call.getString("html");
        final String name = call.getString("name", "Documento");
        if (html == null) {
            call.reject("Missing html");
            return;
        }
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    final WebView wv = new WebView(getActivity());
                    wv.setWebViewClient(new WebViewClient() {
                        @Override
                        public void onPageFinished(WebView view, String url) {
                            try {
                                PrintManager pm = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                                if (pm == null) {
                                    call.reject("PrintManager unavailable");
                                    return;
                                }
                                PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(name);
                                pm.print(name, adapter, new PrintAttributes.Builder().build());
                                call.resolve();
                            } catch (Exception e) {
                                call.reject("print failed: " + e.getMessage());
                            }
                        }
                    });
                    printWebView = wv;
                    wv.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
                } catch (Exception e) {
                    call.reject("print failed: " + e.getMessage());
                }
            }
        });
    }

    @PluginMethod
    public void printPdf(final PluginCall call) {
        final String base64 = call.getString("base64");
        final String name = call.getString("name", "Documento");
        if (base64 == null) {
            call.reject("Missing base64");
            return;
        }
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            final File file = new File(getContext().getCacheDir(), "print_" + System.currentTimeMillis() + ".pdf");
            FileOutputStream fos = new FileOutputStream(file);
            fos.write(bytes);
            fos.close();
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        PrintManager pm = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                        if (pm == null) {
                            call.reject("PrintManager unavailable");
                            return;
                        }
                        pm.print(name, new PdfDocumentAdapter(file, name), new PrintAttributes.Builder().build());
                        call.resolve();
                    } catch (Exception e) {
                        call.reject("print failed: " + e.getMessage());
                    }
                }
            });
        } catch (Exception e) {
            call.reject("print failed: " + e.getMessage());
        }
    }

    /** Streams a pre-rendered PDF file straight to the Android print framework. */
    private static class PdfDocumentAdapter extends PrintDocumentAdapter {
        private final File file;
        private final String name;

        PdfDocumentAdapter(File file, String name) {
            this.file = file;
            this.name = name;
        }

        @Override
        public void onLayout(PrintAttributes oldAttrs, PrintAttributes newAttrs, CancellationSignal signal, LayoutResultCallback cb, Bundle extras) {
            if (signal.isCanceled()) {
                cb.onLayoutCancelled();
                return;
            }
            PrintDocumentInfo info = new PrintDocumentInfo.Builder(name)
                    .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                    .build();
            cb.onLayoutFinished(info, !newAttrs.equals(oldAttrs));
        }

        @Override
        public void onWrite(PageRange[] pages, ParcelFileDescriptor dest, CancellationSignal signal, WriteResultCallback cb) {
            InputStream in = null;
            OutputStream out = null;
            try {
                in = new FileInputStream(file);
                out = new FileOutputStream(dest.getFileDescriptor());
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) >= 0) {
                    if (signal.isCanceled()) {
                        cb.onWriteCancelled();
                        return;
                    }
                    out.write(buf, 0, n);
                }
                cb.onWriteFinished(new PageRange[]{ PageRange.ALL_PAGES });
            } catch (Exception e) {
                cb.onWriteFailed(e.getMessage());
            } finally {
                try { if (in != null) in.close(); } catch (Exception ignored) {}
                try { if (out != null) out.close(); } catch (Exception ignored) {}
            }
        }
    }
}
