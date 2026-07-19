package my.grezto.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;
import java.util.Random;

public class CustomMessagingService extends MessagingService {

    private static String lastProcessedOrderId = null;
    private static long lastProcessedTime = 0;
    private static final long DEDUPE_WINDOW_MS = 60000; // 1 minute

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        
        Map<String, String> data = remoteMessage.getData();
        if (data.size() > 0) {
            String type = data.get("type");
            String orderId = data.get("orderId");

            if ("new_order".equals(type) || "rider_assigned".equals(type)) {
                long now = System.currentTimeMillis();
                // Prevent double popups (e.g., from multiple tokens or server instances)
                if (orderId != null && orderId.equals(lastProcessedOrderId) && (now - lastProcessedTime) < DEDUPE_WINDOW_MS) {
                    android.util.Log.d("CustomMessagingService", "Duplicate push ignored for order: " + orderId);
                    return;
                }
                lastProcessedOrderId = orderId;
                lastProcessedTime = now;

                String title = data.get("title") != null ? data.get("title") : "New Order!";
                String body = data.get("body") != null ? data.get("body") : "Tap to open";
                startFullScreenIntent(title, body, type);
            }
        }
    }

    private void startFullScreenIntent(String title, String body, String type) {
        Context context = getApplicationContext();

        // START THE RINGTONE SERVICE DIRECTLY IN THE BACKGROUND!
        // Because this is triggered by a High-Priority FCM message, Android OS allows us to start a Foreground Service even from the background.
        // This bypasses the UI-blocking restriction of Xiaomi/Oppo/Vivo.
        try {
            Intent serviceIntent = new Intent(context, OrderRingService.class);
            serviceIntent.putExtra("title", title);
            serviceIntent.putExtra("body", body);
            serviceIntent.putExtra("type", type);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                androidx.core.content.ContextCompat.startForegroundService(context, serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void stopRinging() {
        // Handled by OrderRingService now
    }
}
