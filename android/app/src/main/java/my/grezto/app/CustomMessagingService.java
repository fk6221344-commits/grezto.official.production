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

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        
        Map<String, String> data = remoteMessage.getData();
        if (data.size() > 0) {
            String type = data.get("type");
            if ("new_order".equals(type) || "rider_assigned".equals(type)) {
                String title = data.get("title") != null ? data.get("title") : "New Order!";
                String body = data.get("body") != null ? data.get("body") : "Tap to open";
                startFullScreenIntent(title, body, type);
            }
        }
    }

    private void startFullScreenIntent(String title, String body, String type) {
        Context context = getApplicationContext();

        // Intent to launch MainActivity
        Intent fullScreenIntent = new Intent(context, MainActivity.class);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        fullScreenIntent.putExtra("title", title);
        fullScreenIntent.putExtra("body", body);
        fullScreenIntent.putExtra("type", type);
        fullScreenIntent.putExtra("trigger_ringtone", true); // Flag to tell MainActivity to ring

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                context,
                0,
                fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, "grezto_order_channel_v5")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setAutoCancel(true);

        try {
            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            notificationManager.notify(new Random().nextInt(1000), builder.build());
        } catch (SecurityException e) {
            e.printStackTrace();
        }
    }

    public static void stopRinging() {
        // Handled by OrderRingService now
    }
}
