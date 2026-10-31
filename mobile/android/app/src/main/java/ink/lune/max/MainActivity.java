package ink.lune.max;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

/**
 * Max 财经 · Android 外壳入口。
 *
 * 除了 Capacitor 默认的 BridgeActivity 行为，这里补了两件「不补就会被用户当成 bug」的事：
 *
 * 1) 返回键：Capacitor 默认不接管返回键，二级页面按一下返回就直接退出 App。
 *    站点是客户端路由（pushState），WebView 历史里是有条目的，所以先 canGoBack()
 *    → goBack()，只有回到根页面才交给系统退出。
 *    注意：targetSdk 36 若开启 enableOnBackInvokedCallback（预测性返回），
 *    需要把这段迁移成 OnBackPressedCallback；当前 AndroidManifest 未开启该属性，
 *    因此重写 onBackPressed 仍然是最简单且兼容的选择。
 *
 * 2) 下载：WebView 默认不处理下载，CSV 导出这类带 Content-Disposition 的链接
 *    点了没有任何反应。交给系统 DownloadManager，并把 Cookie 一起带过去
 *    （导出接口需要登录态），否则下载回来的是 401 页面。
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        installDownloadListener();
    }

    @Override
    public void onBackPressed() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    /** 交给系统下载器，带上登录 Cookie；文件名优先用 Content-Disposition 里的 */
    private void installDownloadListener() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimeType, long contentLength) {
                try {
                    String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    request.setMimeType(mimeType);
                    request.addRequestHeader("User-Agent", userAgent);
                    // 导出接口按 session Cookie 鉴权：不带 Cookie 会下到一个 401 JSON
                    String cookie = CookieManager.getInstance().getCookie(url);
                    if (cookie != null) request.addRequestHeader("Cookie", cookie);
                    request.setDescription("Max 财经导出文件");
                    request.setTitle(fileName);
                    request.allowScanningByMediaScanner();
                    request.setNotificationVisibility(
                            DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(
                            Environment.DIRECTORY_DOWNLOADS, fileName);

                    DownloadManager dm =
                            (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    if (dm != null) {
                        dm.enqueue(request);
                        Toast.makeText(getApplicationContext(), "已开始下载：" + fileName,
                                Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception e) {
                    // 下载失败不该让页面崩掉，给用户一个明确反馈即可
                    Toast.makeText(getApplicationContext(), "下载失败，请在浏览器中打开本页重试",
                            Toast.LENGTH_LONG).show();
                }
            }
        });
    }
}
