import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getApiUrl } from '../utils/api';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function compressImage(file: File, maxWidth: number = 2048, quality: number = 0.95): Promise<Blob | File> {
  return new Promise((resolve) => {
    if (!window.FileReader || !window.HTMLCanvasElement) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Only scale down if it's ridiculously huge, otherwise keep original size for ultra quality
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxWidth) {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Convert to WebP for high quality with good compression
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                resolve(file);
              }
            },
            'image/webp',
            quality
          );
        } catch (e) {
          console.warn("Image compression failed, using original file:", e);
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

/**
 * Uploads a file (or Blob) to the secure Node backend which forwards to Cloudflare R2.
 */
export async function uploadToR2(blob: Blob | File, folder: string, originalName: string = "image.webp"): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob, originalName);
  formData.append("folder", folder);
  formData.append("cleanName", originalName);

  const apiUrl = getApiUrl("/api/upload");
  const res = await fetch(apiUrl, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorData: any = {};
    try {
      errorData = JSON.parse(errorText);
    } catch (e) {
      errorData.error = `Server error ${res.status}: ${errorText.substring(0, 100)}`;
    }
    throw new Error(errorData.error || "Upload failed");
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
  }
  
  if (!data.success) {
    throw new Error(data.error || "Upload failed");
  }
  
  return data.url;
}

