package my.grezto.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class CustomMessagingService extends MessagingService {

    public static MediaPlayer mediaPlayer;
    public static Vibrator vibrator;

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        
        Map<String, String> data = remoteMessage.getData();
        if (data.size() > 0) {
            String type = data.get("type");
            if ("new_order".equals(type) || "rider_assigned".equals(type)) {
                String title = data.get("title") != null ? data.get("title") : "New Order!";
                String body = data.get("body") != null ? data.get("body") : "Tap to open";
                showFullScreenNotification(title, body);
            }
        }
    }

    private void showFullScreenNotification(String title, String body) {
        Context context = getApplicationContext();

        // 1. Wake up the screen
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                PowerManager.FULL_WAKE_LOCK |
                PowerManager.ACQUIRE_CAUSES_WAKEUP |
                PowerManager.ON_AFTER_RELEASE,
                "GreztoApp::OrderWakeLock"
            );
            wakeLock.acquire(10000); // 10 seconds
        }

        // 2. Start loud looping ringtone & vibrate
        startRinging(context);

        // 3. Create Notification Channel
        String channelId = "grezto_fullscreen_channel_v1";
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                channelId,
                "Order Alerts (High Priority)",
                NotificationManager.IMPORTANCE_HIGH
            );
            // We set sound to null because we play MediaPlayer manually for looping
            channel.setSound(null, null);
            channel.enableVibration(false); // We vibrate manually
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }

        // 4. Intent for opening the app and stopping ringtone
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        int pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingIntentFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            0,
            openAppIntent,
            pendingIntentFlags
        );

        // 5. Intent for dismissing (swiping away) the notification
        Intent dismissIntent = new Intent(context, StopRingReceiver.class);
        PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
            context,
            1,
            dismissIntent,
            pendingIntentFlags
        );

        // 6. Build the Notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher) // Use app icon
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setOngoing(true) // Cannot be easily swiped away without triggering dismiss
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .setDeleteIntent(dismissPendingIntent);

        if (notificationManager != null) {
            notificationManager.notify(1001, builder.build());
        }
    }

    private void startRinging(Context context) {
        stopRinging(); // Stop any existing

        // Vibrate
        vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator != null) {
            long[] pattern = {0, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000};
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0)); // 0 means loop from index 0
            } else {
                vibrator.vibrate(pattern, 0);
            }
        }

        // Audio
        try {
            int soundResId = context.getResources().getIdentifier("spaceship_alarm", "raw", context.getPackageName());
            if (soundResId == 0) return; // Audio not found

            Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + soundResId);
            
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build()
            );
            mediaPlayer.setDataSource(context, soundUri);
            mediaPlayer.setLooping(true); // Loops infinitely!
            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void stopRinging() {
        if (mediaPlayer != null) {
            if (mediaPlayer.isPlaying()) mediaPlayer.stop();
            mediaPlayer.release();
            mediaPlayer = null;
        }
        if (vibrator != null) {
            vibrator.cancel();
            vibrator = null;
        }
    }
}
