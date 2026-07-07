importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { notification: { title: 'New Grezto Order!', body: event.data.text() }};
    }
  }

  const title = data?.notification?.title || data?.data?.title || "Mission Alert 🚨";
  const body = data?.notification?.body || data?.data?.body || "Check the Rider App for a new assigned order.";
  const icon = '/favicon.ico'; // Optional icon path

  // Web Push Sound Trick
  // If a payload specifies sound, but many browsers ignore it.
  // We can try to play a sound via Audio object in SW, but that requires user interaction.
  // The best way is to send the message to the clients and let them play audio,
  // AND show a persistent notification that requires interaction.

  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'ALARM_TRIGGERS',
        payload: data
      });
    });
  });

  const options = {
    body,
    icon,
    vibrate: [1500, 200, 1500, 200, 2000, 300, 2000, 300, 2000, 300, 3000, 500, 3000],
    requireInteraction: true,
    data: data
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(windowClients => {
      // Send message to stop the alarm when notification is clicked
      windowClients.forEach(client => {
         client.postMessage({ type: 'STOP_ALARM' });
      });
      // Check if there is already a window/tab open with the target URL
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        // If so, just focus it.
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, then open the target URL in a new window/tab.
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
