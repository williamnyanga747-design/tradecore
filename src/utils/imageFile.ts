export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const MAX_IMAGE_DIM = 900;
const JPEG_QUALITY = 0.8;

export function resizeImageDataUrl(dataUrl: string, maxDim: number = MAX_IMAGE_DIM): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      if (scale >= 1) {
        resolve(dataUrl);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error('Invalid image'));
    img.src = dataUrl;
  });
}

export async function readAndResizeImage(file: File, maxDim: number = MAX_IMAGE_DIM): Promise<string> {
  const raw = await readFileAsDataUrl(file);
  return resizeImageDataUrl(raw, maxDim);
}

export function makePlaceholderImage(label: string, bg: string = '#eab308'): string {
  const text = (label || '?').replace(/["<>&]/g, '').slice(0, 3).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450"><rect width="600" height="450" fill="${bg}"/><text x="50%" y="50%" font-family="Arial, sans-serif" font-size="120" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
