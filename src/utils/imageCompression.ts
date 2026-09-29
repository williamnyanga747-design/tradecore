/**
 * Client-Side Image Compression Utility
 * 
 * Compresses product photos and camera snapshots directly in the browser
 * before uploading or saving to local/remote storage, reducing payload sizes
 * by 85-98% while maintaining crisp display quality.
 */

export interface CompressionOptions {
  /** Maximum width in pixels (default: 1024) */
  maxWidth?: number;
  /** Maximum height in pixels (default: 1024) */
  maxHeight?: number;
  /** Compression quality between 0.1 and 1.0 (default: 0.78) */
  quality?: number;
  /** Preferred mime type ('image/jpeg' or 'image/webp', default: 'image/jpeg') */
  mimeType?: 'image/jpeg' | 'image/webp';
  /** If true, preserves transparency by using image/webp or PNG for images with alpha channel */
  preserveAlpha?: boolean;
}

export interface CompressedImageResult {
  dataUrl: string;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
  savingsPercent: number;
  mimeType: string;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.78,
  mimeType: 'image/jpeg',
  preserveAlpha: true,
};

/**
 * Format raw byte count into a human-readable string (e.g., "1.4 MB", "85 KB")
 */
export function formatByteSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 && i > 0 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

/**
 * Estimates the byte size of a base64 data URL string
 */
export function estimateDataUrlBytes(dataUrl: string): number {
  if (!dataUrl) return 0;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  const base64Str = dataUrl.slice(commaIdx + 1);
  const padding = (base64Str.endsWith('==') ? 2 : base64Str.endsWith('=') ? 1 : 0);
  return Math.max(0, Math.floor((base64Str.length * 3) / 4) - padding);
}

/**
 * Load an Image element from a Blob or Data URL
 */
function loadImageSource(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Failed to load image source for compression'));
    img.src = src;
  });
}

/**
 * Calculates constrained dimensions while preserving aspect ratio
 */
export function calculateConstrainedDimensions(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (srcWidth <= 0 || srcHeight <= 0) {
    return { width: maxWidth, height: maxHeight };
  }

  let width = srcWidth;
  let height = srcHeight;

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  return {
    width: Math.max(1, width),
    height: Math.max(1, height)
  };
}

/**
 * Compresses an HTMLVideoElement frame directly from a live camera stream
 */
export async function compressVideoFrame(
  video: HTMLVideoElement,
  options?: CompressionOptions
): Promise<CompressedImageResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const rawWidth = video.videoWidth || 1280;
  const rawHeight = video.videoHeight || 720;
  const { width, height } = calculateConstrainedDimensions(rawWidth, rawHeight, opts.maxWidth, opts.maxHeight);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(video, 0, 0, width, height);

  const dataUrl = canvas.toDataURL(opts.mimeType, opts.quality);
  const compressedBytes = estimateDataUrlBytes(dataUrl);
  // Estimate uncompressed raw video frame (RGBA 4 bytes per pixel)
  const estimatedOriginal = rawWidth * rawHeight * 3;
  const savingsPercent = Math.max(0, Math.round((1 - compressedBytes / estimatedOriginal) * 100));

  return {
    dataUrl,
    originalBytes: estimatedOriginal,
    compressedBytes,
    width,
    height,
    savingsPercent,
    mimeType: opts.mimeType,
  };
}

/**
 * Compresses a Data URL string directly
 */
export async function compressImageDataUrl(
  dataUrl: string,
  options?: CompressionOptions
): Promise<CompressedImageResult> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    const rawBytes = estimateDataUrlBytes(dataUrl);
    return {
      dataUrl,
      originalBytes: rawBytes,
      compressedBytes: rawBytes,
      width: 0,
      height: 0,
      savingsPercent: 0,
      mimeType: 'image/jpeg',
    };
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalBytes = estimateDataUrlBytes(dataUrl);

  const img = await loadImageSource(dataUrl);
  const { width, height } = calculateConstrainedDimensions(img.naturalWidth || img.width, img.naturalHeight || img.height, opts.maxWidth, opts.maxHeight);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const hasAlpha = opts.preserveAlpha && (dataUrl.includes('image/png') || dataUrl.includes('image/webp'));
  const ctx = canvas.getContext('2d', { alpha: hasAlpha });
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  if (!hasAlpha) {
    // Fill solid background for non-alpha formats like JPEG
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  let targetMime = opts.mimeType;
  if (hasAlpha) {
    targetMime = 'image/webp';
  }

  let compressedDataUrl = canvas.toDataURL(targetMime, opts.quality);
  // Fallback to jpeg if webp is not supported by this browser
  if (targetMime === 'image/webp' && !compressedDataUrl.startsWith('data:image/webp')) {
    targetMime = 'image/jpeg';
    compressedDataUrl = canvas.toDataURL(targetMime, opts.quality);
  }

  const compressedBytes = estimateDataUrlBytes(compressedDataUrl);

  // If the compressed output somehow ended up larger than the original small file, keep original
  if (compressedBytes >= originalBytes && (img.naturalWidth || img.width) <= opts.maxWidth && (img.naturalHeight || img.height) <= opts.maxHeight) {
    return {
      dataUrl,
      originalBytes,
      compressedBytes: originalBytes,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      savingsPercent: 0,
      mimeType: targetMime,
    };
  }

  const savingsPercent = Math.max(0, Math.round((1 - compressedBytes / originalBytes) * 100));

  return {
    dataUrl: compressedDataUrl,
    originalBytes,
    compressedBytes,
    width,
    height,
    savingsPercent,
    mimeType: targetMime,
  };
}

/**
 * Compresses an image File or Blob with automatic orientation and dimensions scaling
 */
export async function compressImageFile(
  file: File | Blob,
  options?: CompressionOptions
): Promise<CompressedImageResult> {
  const originalBytes = file.size;
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // For SVG files, don't rasterize to JPEG/lossy canvas
  if (file.type === 'image/svg+xml') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const bytes = estimateDataUrlBytes(dataUrl);
        resolve({
          dataUrl,
          originalBytes,
          compressedBytes: bytes,
          width: 0,
          height: 0,
          savingsPercent: 0,
          mimeType: 'image/svg+xml'
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Try modern createImageBitmap with automatic orientation if supported
  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
      const { width, height } = calculateConstrainedDimensions(bitmap.width, bitmap.height, opts.maxWidth, opts.maxHeight);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const hasAlpha = opts.preserveAlpha && (file.type === 'image/png' || file.type === 'image/webp');
      const ctx = canvas.getContext('2d', { alpha: hasAlpha });
      if (ctx) {
        if (!hasAlpha) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        let targetMime = opts.mimeType;
        if (hasAlpha) {
          targetMime = 'image/webp';
        }

        let compressedDataUrl = canvas.toDataURL(targetMime, opts.quality);
        if (targetMime === 'image/webp' && !compressedDataUrl.startsWith('data:image/webp')) {
          targetMime = 'image/jpeg';
          compressedDataUrl = canvas.toDataURL(targetMime, opts.quality);
        }

        const compressedBytes = estimateDataUrlBytes(compressedDataUrl);
        const savingsPercent = Math.max(0, Math.round((1 - compressedBytes / originalBytes) * 100));

        return {
          dataUrl: compressedDataUrl,
          originalBytes,
          compressedBytes,
          width,
          height,
          savingsPercent,
          mimeType: targetMime,
        };
      }
    } catch {
      // Fallback to FileReader + HTMLImageElement below if createImageBitmap fails
    }
  }

  // Fallback: Read file to data URL and compress via image element
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rawDataUrl = String(reader.result || '');
        const result = await compressImageDataUrl(rawDataUrl, { ...opts });
        resolve({
          ...result,
          originalBytes: originalBytes || result.originalBytes,
          savingsPercent: originalBytes ? Math.max(0, Math.round((1 - result.compressedBytes / originalBytes) * 100)) : result.savingsPercent,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (e) => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Convenient shorthand helper that directly returns the compressed Data URL string
 */
export async function compressImage(
  input: File | Blob | string,
  options?: CompressionOptions
): Promise<string> {
  if (typeof input === 'string') {
    const res = await compressImageDataUrl(input, options);
    return res.dataUrl;
  }
  const res = await compressImageFile(input, options);
  return res.dataUrl;
}
