importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by fetching from config endpoint if possible
// Alternatively, since this is a public file, we'll try to listen to the push event directly 
// or require the app to pass config to it using URL params, but standard approach requires config here.
// For security and simplicity, we can receive config from the client:
let messaging;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    firebase.initializeApp(event.data.config);
    messaging = firebase.messaging();
    
    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message ', payload);
      
      const notificationTitle = payload.notification?.title || 'System Alert';
      const notificationOptions = {
        body: payload.notification?.body || 'New order status update',
        icon: '/vite.svg',
        data: payload.data
      };

      self.registration.showNotification(notificationTitle, notificationOptions);

      // Trigger frontend to play alarm if possible
      self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'ALARM_TRIGGERS' }));
      });
    });
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  // Custom click action
  self.clients.matchAll().then(clients => {
      clients.forEach(client => client.postMessage({ type: 'STOP_ALARM' }));
  });

  // Focus the window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
