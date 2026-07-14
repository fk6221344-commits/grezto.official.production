package my.grezto.app;

import android.os.Bundle;
import android.content.res.Resources;
import android.content.res.Configuration;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.crashlytics.FirebaseCrashlytics;
import androidx.core.splashscreen.SplashScreen;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        
        // Match the WebView background to our Splash Screen color to prevent any white flash during boot!
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setBackgroundColor(android.graphics.Color.parseColor("#fffdfa"));
            // Enforce WebView TextZoom to exactly 100% to disable system-level font scaling
            this.bridge.getWebView().getSettings().setTextZoom(100);
        }

        try {
            FirebaseApp.initializeApp(this);
            // Log a test non-fatal exception to automatically wake-up/initialize the Crashlytics dashboard with my.grezto.app!
            FirebaseCrashlytics.getInstance().log("Grezto App Started - Auto-initializing Crashlytics");
            FirebaseCrashlytics.getInstance().setCustomKey("grezto_auto_test_run", true);
            FirebaseCrashlytics.getInstance().recordException(new RuntimeException("Grezto Crashlytics Auto-Test Connection Exception"));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // Bulletproof Native Override: Forces system-level FontScale context to exactly 1.0 (100%)
    @Override
    public Resources getResources() {
        Resources res = super.getResources();
        if (res != null) {
            Configuration config = res.getConfiguration();
            if (config != null && config.fontScale != 1.0f) {
                Configuration newConfig = new Configuration(config);
                newConfig.fontScale = 1.0f;
                res.updateConfiguration(newConfig, res.getDisplayMetrics());
            }
        }
        return res;
    }
}
