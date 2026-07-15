package my.grezto.app;

import android.os.Bundle;
import android.content.res.Resources;
import android.content.res.Configuration;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.crashlytics.FirebaseCrashlytics;
import androidx.core.splashscreen.SplashScreen;
import android.content.Intent;
import android.os.Build;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        
        // Turn screen on and show when locked
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        // Request battery optimization ignore for background notifications
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(android.content.Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                try {
                    Intent intent = new Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(android.net.Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }

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

    @Override
    public void onResume() {
        super.onResume();
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    private void stopOrderRingService() {
        try {
            Intent serviceIntent = new Intent(this, OrderRingService.class);
            serviceIntent.setAction(OrderRingService.ACTION_STOP);
            startService(serviceIntent);
            
            android.app.NotificationManager notificationManager = (android.app.NotificationManager) getSystemService(android.content.Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.cancel(1001);
            }
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
