package my.grezto.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class OrderRingService extends Service {
    private static final String TAG = "OrderRingService";
    private static final String CHANNEL_ID = "grezto_critical_orders";
    
    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;

    public static final String ACTION_STOP = "my.grezto.app.ACTION_STOP_RINGING";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String title = intent != null ? intent.getStringExtra("title") : "🚨 New Order Received! 🚨";
        String body = intent != null ? intent.getStringExtra("body") : "Please open the app to accept.";
        String type = intent != null ? intent.getStringExtra("type") : "new_order";

        // 1. Wake the screen up forcefully
        acquireWakeLock();

        // 2. Start the foreground notification
        startForegroundServiceNotification(title, body);

        // 3. Start looping ringtone & vibration
        startRinging(type);

        return START_NOT_STICKY; // If killed, don't restart automatically without new push
    }

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "Grezto::IncomingOrderWakeLock"
            );
            wakeLock.acquire(3 * 60 * 1000L /*3 minutes timeout*/);
            Log.d(TAG, "WakeLock acquired to turn on the screen.");
        }
    }

    private void startForegroundServiceNotification(String title, String body) {
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Critical Order Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Loud alarm for new orders");
            channel.setSound(null, null); // Sound is played by MediaPlayer
            channel.enableVibration(false); // Vibrate is done manually
            notificationManager.createNotificationChannel(channel);
        }

        // The intent that fires when tapping the notification banner OR the Accept button
        Intent fullScreenIntent = new Intent(this, MainActivity.class);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        fullScreenIntent.putExtra("stop_ring", true);
        PendingIntent pendingIntentFlags = PendingIntent.getActivity(
            this,
            0,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true) // Can't swipe away
            .setAutoCancel(false)
            .setContentIntent(pendingIntentFlags)
            .addAction(0, "✅ ACCEPT", pendingIntentFlags); // The explicit Accept button

        Notification notification = builder.build();
        startForeground(1001, notification);
    }

    private void startRinging(String type) {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) mediaPlayer.stop();
                mediaPlayer.release();
            } catch (Exception e) {}
            mediaPlayer = null;
        }

        // Vibrate
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator != null) {
            long[] pattern = {0, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000};
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            } else {
                vibrator.vibrate(pattern, 0);
            }
        }

        // Audio
        try {
            String soundName = "spaceship_alarm";
            if ("rider_assigned".equals(type)) {
                soundName = "rider_alarm";
            }

            int soundResId = getResources().getIdentifier(soundName, "raw", getPackageName());
            if (soundResId == 0) {
                soundResId = getResources().getIdentifier("spaceship_alarm", "raw", getPackageName());
            }
            if (soundResId == 0) {
                Log.e(TAG, "Ringtone resource not found!");
                return;
            }

            Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + soundResId);
            
            // Request Audio Focus to pause background music (e.g. Spotify)
            android.media.AudioManager audioManager = (android.media.AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    android.media.AudioFocusRequest focusRequest = new android.media.AudioFocusRequest.Builder(android.media.AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                            .setAudioAttributes(
                                new AudioAttributes.Builder()
                                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                    .build()
                            )
                            .setAcceptsDelayedFocusGain(false)
                            .build();
                    audioManager.requestAudioFocus(focusRequest);
                } else {
                    audioManager.requestAudioFocus(null, android.media.AudioManager.STREAM_RING, android.media.AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
                }
            }

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build()
            );
            mediaPlayer.setDataSource(this, soundUri);
            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
            Log.d(TAG, "Ringtone started successfully with USAGE_NOTIFICATION_RINGTONE and AudioFocus.");
        } catch (Exception e) {
            Log.e(TAG, "Error playing ringtone", e);
            e.printStackTrace();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "OrderRingService destroyed. Stopping ringtone and releasing WakeLock.");
        
        if (mediaPlayer != null) {
            if (mediaPlayer.isPlaying()) {
                mediaPlayer.stop();
            }
            mediaPlayer.release();
            mediaPlayer = null;
        }

        if (vibrator != null) {
            vibrator.cancel();
            vibrator = null;
        }

        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
