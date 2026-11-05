package com.isleplace.converter;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.util.Map;

/**
 * The site is static with "directory" URLs (/ru/heic-to-jpg/). Capacitor's local server treats
 * extension-less paths as an SPA route and returns the root index.html, which would loop the
 * language redirect. Rewrite ".../" to ".../index.html" so every page is served as built.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String path = url.getPath();
                if ("localhost".equals(url.getHost()) && path != null && path.length() > 1 && path.endsWith("/")) {
                    Uri index = url.buildUpon().path(path + "index.html").build();
                    return super.shouldInterceptRequest(view, withUrl(request, index));
                }
                return super.shouldInterceptRequest(view, request);
            }
        });
    }

    private static WebResourceRequest withUrl(WebResourceRequest original, Uri url) {
        return new WebResourceRequest() {
            @Override public Uri getUrl() { return url; }
            @Override public boolean isForMainFrame() { return original.isForMainFrame(); }
            @Override public boolean isRedirect() { return original.isRedirect(); }
            @Override public boolean hasGesture() { return original.hasGesture(); }
            @Override public String getMethod() { return original.getMethod(); }
            @Override public Map<String, String> getRequestHeaders() { return original.getRequestHeaders(); }
        };
    }
}
