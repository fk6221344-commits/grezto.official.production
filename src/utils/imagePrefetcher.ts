/**
 * High-Performance Background Image Prefetcher for Zero-Lag UX
 */

export function prefetchImage(url: string): Promise<string> {
  return new Promise((resolve) => {
    if (!url) {
      resolve('');
      return;
    }
    const img = new Image();
    img.src = url;
    if (img.complete) {
      resolve(url);
    } else {
      img.onload = () => resolve(url);
      img.onerror = () => resolve(''); // Resolve peacefully so errors do not crash other queues
    }
  });
}

export function prefetchImages(urls: string[]): Promise<string[]> {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  return Promise.all(uniqueUrls.map(url => prefetchImage(url)));
}
