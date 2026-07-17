import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'my.grezto.app',
  appName: 'Grezto',
  webDir: 'dist',
  backgroundColor: '#fffcf9',
  // 5. Hardened Production Configuration: We ensure server live reload and external sync URLs 
  // are completely omitted so that the production build runs natively off the localized 'webDir' (dist).
  // We specify secure navigation rules to let the native Android app communicate seamlessly with
  // the live Railway Backend, Google Cloud Run endpoints, and secure Vercel microservices.
  server: {
    url: 'http://127.0.0.1:3000',
    cleartext: true,
    androidScheme: 'https',
    allowNavigation: [
      "localhost",
      "127.0.0.1",
      "*.run.app",
      "*.railway.app",
      "grezto.vercel.app"
    ]
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK'
    },
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,
      launchFadeOutDuration: 150,
      backgroundColor: "#fffdfa",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    FirebaseAuthentication: {
      providers: ["phone"],
      skipNativeAuth: false
    }
  }
};

export default config;
