import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

export interface AppUpdateInfo {
  latestVersionCode: number;
  forceUpdate: boolean;
  downloadUrl: string;
  title: string;
  message: string;
}

export const useAppUpdate = () => {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        if (!Capacitor.isNativePlatform()) {
          setIsChecking(false);
          return;
        }

        // Fetch latest version info from the server
        const API_URL = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${API_URL}/api/app-update-info`);
        
        if (response.ok) {
          const data: AppUpdateInfo = await response.json();
          
          // Get current native app info
          const appInfo = await CapApp.getInfo();
          // The 'build' property usually represents the versionCode in Android
          const currentVersionCode = Number(appInfo.build || "1");

          if (currentVersionCode < data.latestVersionCode) {
            setUpdateInfo(data);
            setShowUpdateModal(true);
          }
        }
      } catch (error) {
        console.error("Failed to check for app update:", error);
      } finally {
        setIsChecking(false);
      }
    };

    checkUpdate();
  }, []);

  const dismissUpdate = () => {
    if (updateInfo && !updateInfo.forceUpdate) {
      setShowUpdateModal(false);
    }
  };

  return {
    showUpdateModal,
    updateInfo,
    dismissUpdate,
    isChecking
  };
};
