package com.my.grezto;

import android.os.Bundle;
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
        }

        try {
            FirebaseApp.initializeApp(this);
            // Log a test non-fatal exception to automatically wake-up/initialize the Crashlytics dashboard with com.my.grezto!
            FirebaseCrashlytics.getInstance().log("Grezto App Started - Auto-initializing Crashlytics");
            FirebaseCrashlytics.getInstance().setCustomKey("grezto_auto_test_run", true);
            FirebaseCrashlytics.getInstance().recordException(new RuntimeException("Grezto Crashlytics Auto-Test Connection Exception"));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
