import { supabase } from '../services/supabase';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

export interface OTAUpdateInfo {
  latestVersionCode: number;
  otaBundleVersion?: string;
  forceUpdate?: boolean;
  downloadUrl?: string;
  title?: string;
  message?: string;
  activePromoPopup?: {
    enabled: boolean;
    id: string;
    title: string;
    subtitle: string;
    badgeText?: string;
    image?: string;
    buttonText?: string;
    discountCode?: string;
  };
}

const CURRENT_OTA_VERSION = '1.0.0';

/**
 * Initializes the OTA Live Updater pipeline.
 * Checks Railway Backend API / Supabase for version updates and active promotions.
 */
export async function initOTAUpdater(): Promise<OTAUpdateInfo | null> {
  try {
    // Notify native Capgo updater plugin that current bundle is healthy
    CapacitorUpdater.notifyAppReady().catch(() => {});
    console.log('[OTA UPDATER] Checking for live OTA code updates and promotions...');

    // 1. Primary Railway API Endpoint check
    const railwayEndpoint = 'https://api.grezto.com/api/app-update-info';
    let res = await fetch(railwayEndpoint, { cache: 'no-store' }).catch(() => null);

    let info: OTAUpdateInfo | null = null;

    if (res && res.ok) {
      info = await res.json().catch(() => null);
    }

    // 2. Fallback check directly from Supabase system_config
    if (!info) {
      const { data: sysConfig } = await supabase
        .from('system_config')
        .select('*')
        .eq('id', 'ota_config')
        .maybeSingle();

      if (sysConfig) {
        info = {
          latestVersionCode: sysConfig.version_code || 1,
          otaBundleVersion: sysConfig.bundle_version || '1.0.0',
          forceUpdate: sysConfig.force_update || false,
          activePromoPopup: sysConfig.active_promo || null
        };
      }
    }

    if (info) {
      console.log('[OTA UPDATER] Live update info retrieved successfully:', info);
      const storedVersion = localStorage.getItem('grezto_ota_bundle_version') || CURRENT_OTA_VERSION;

      if (info.otaBundleVersion && info.otaBundleVersion !== storedVersion && info.downloadUrl) {
        console.log(`[OTA UPDATER] Downloading new OTA bundle version ${info.otaBundleVersion} from custom server...`);
        
        try {
          // Download the zip bundle
          const downloaded = await CapacitorUpdater.download({
            url: info.downloadUrl,
            version: info.otaBundleVersion,
          });

          console.log('[OTA UPDATER] Download complete. Applying update...');
          
          // Set it as the active version (this reloads the app)
          await CapacitorUpdater.set({ id: downloaded.id });
          
          // Update local cache
          localStorage.setItem('grezto_ota_bundle_version', info.otaBundleVersion);
        } catch (downloadError) {
          console.error('[OTA UPDATER] Failed to download or apply OTA update zip:', downloadError);
        }
      }
    }

    return info;
  } catch (error) {
    console.warn('[OTA UPDATER FAIL-SAFE] Update check encountered non-fatal exception. Using built-in native fallback.', error);
    return null;
  }
}
