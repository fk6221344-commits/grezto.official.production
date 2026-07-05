// High-performance canvas cropping & compression to fit under Firestore document limits
export function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: any,
): Promise<string> {
  const image = await createImage(imageSrc);

  // Set reasonable maximum dimensions for responsive cropped thumbnails (e.g., max 240px width/height)
  const maxDim = 240;
  let targetWidth = pixelCrop.width;
  let targetHeight = pixelCrop.height;

  if (targetWidth > maxDim || targetHeight > maxDim) {
    if (targetWidth > targetHeight) {
      targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
      targetWidth = maxDim;
    } else {
      targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
      targetHeight = maxDim;
    }
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return "";

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // Use image smoothing techniques for a crisp scaled display
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  return new Promise((resolve) => {
    // Compress to JPEG with 0.5 quality to ensure ultra lightweight file size (under 5-10KB)
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
      },
      "image/jpeg",
      0.5,
    );
  });
}
