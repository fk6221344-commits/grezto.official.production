# Grezto Android Bundle Configuration Guide (`com.my.grezto`)
This guide provides copy-pasteable configuration files to package the Grezto React/Vite application into a native Android wrapper (using Capacitor or Cordova) targeting our live Firebase project `project-4adf87a7-03c0-48e0-a8f` with the official package signature `com.my.grezto`.

---

## 1. Android Manifest Configuration (`AndroidManifest.xml`)
Add the following high-priority permissions and service receivers to `/android/app/src/main/AndroidManifest.xml` to enable real-time order tracking, offline map caching, push alerts, and physical alarm vibrations:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.my.grezto">

    <!-- 1. Internet & Connectivity Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />

    <!-- 2. Real-Time Rider GPS Tracking Permissions -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-feature android:name="android.hardware.location.gps" android:required="false" />

    <!-- 3. Push Notifications & Vibration Feedback Permissions -->
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Grezto"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:label="Grezto"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            
            <!-- Deep linking refer invitation filters -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="grezto.com" />
            </intent-filter>
        </activity>

        <!-- Firebase Cloud Messaging Receiver Service -->
        <service
            android:name="com.google.firebase.messaging.FirebaseMessagingService"
            android:exported="false">
            <intent-filter android:priority="-500">
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
    </application>
</manifest>
```

---

## 2. Root Gradle Build Configuration (`/android/build.gradle`)
Add the Google Services classpath plugin to your root build dependencies list:

```groovy
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.2.0'
        // Firebase Services Plugin
        classpath 'com.google.gms:google-services:4.4.1'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
```

---

## 3. Module Level Gradle Configuration (`/android/app/build.gradle`)
Apply the Google services plugin and configure dependencies matching the namespace `com.my.grezto` and the specified components:

```groovy
apply plugin: 'com.android.application'
apply plugin: 'com.google.gms.google-services' // Enables automatic google-services.json parsing

android {
    namespace "com.my.grezto"
    compileSdk 34

    defaultConfig {
        applicationId "com.my.grezto"
        minSdk 22
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}

dependencies {
    // 1. AndroidX Core Elements
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'

    // 2. High-Performance Native Firebase Android SDK (with BOM version control)
    implementation platform('com.google.firebase:firebase-bom:32.8.0')
    
    // Core SDKs mapped corresponding to client requirements
    implementation 'com.google.firebase:firebase-auth'               // Auth management
    implementation 'com.google.firebase:firebase-firestore'          // Multi-platform live database sync
    implementation 'com.google.firebase:firebase-storage'            // High-capacity image upload pipeline
    implementation 'com.google.firebase:firebase-messaging'          // Cloud notifications engine
    implementation 'com.google.firebase:firebase-analytics'          // Production tracking analytics
}
```

---

## 4. How to link `google-services.json`
1. Navigate to your [Firebase Console](https://console.firebase.google.com/) for the project `project-4adf87a7-03c0-48e0-a8f`.
2. Select **Settings** > **Project Settings** > **General**.
3. Under *Your apps*, click **Add App** and register an **Android App** with:
   - Package Name: `com.my.grezto`
   - App Nickname: `Grezto Android App`
4. Download the custom compiled `google-services.json` bundle configuration.
5. Drop `google-services.json` (which is already configured in your root workspace as `/google-services.json`) directly into your `/android/app/` subdirectory.
6. Trigger the clean compilation run inside Android Studio or via shell CLI: `./gradlew assembleDebug`
