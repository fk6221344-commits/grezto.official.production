package my.grezto.app;

import android.content.Context;
import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "GreztoNative")
public class GreztoNativePlugin extends Plugin {

    @PluginMethod
    public void stopOrderRingService(PluginCall call) {
        try {
            Context context = getContext();
            
            // Stop the Foreground Service
            Intent serviceIntent = new Intent(context, OrderRingService.class);
            serviceIntent.setAction(OrderRingService.ACTION_STOP);
            context.startService(serviceIntent);
            
            // Cancel the ongoing notification
            android.app.NotificationManager notificationManager = (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.cancel(1001);
            }
            
            call.resolve();
        } catch (Exception e) {
            e.printStackTrace();
            call.reject("Failed to stop order ring service", e);
        }
    }
}
