package my.grezto.app;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class CustomMessagingService extends MessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        
        Map<String, String> data = remoteMessage.getData();
        if (data.size() > 0) {
            String type = data.get("type");
            if ("new_order".equals(type) || "rider_assigned".equals(type)) {
                String title = data.get("title") != null ? data.get("title") : "New Order!";
                String body = data.get("body") != null ? data.get("body") : "Tap to open";
                startOrderRingService(title, body, type);
            }
        }
    }

    private void startOrderRingService(String title, String body, String type) {
        Context context = getApplicationContext();
        Intent serviceIntent = new Intent(context, OrderRingService.class);
        serviceIntent.putExtra("title", title);
        serviceIntent.putExtra("body", body);
        serviceIntent.putExtra("type", type);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(context, serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
    }

    // Keep this for backwards compatibility with any other receivers, though we'll use Action now
    public static void stopRinging() {
        // Handled by OrderRingService now
    }
}
