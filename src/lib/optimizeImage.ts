export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const DEFAULT_OPTIONS: Required<ImageOptimizationOptions> = {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.85,
};

/**
 * Checks whether a file is an image that should be compressed and converted to WebP.
 * Excludes GIFs (to preserve animation) and SVGs (to preserve vector data).
 */
export function isOptimizableImage(file: File): boolean {
  if (!file) return false;
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();

  if (mime === 'image/gif' || mime === 'image/svg+xml' || name.endsWith('.gif') || name.endsWith('.svg')) {
    return false;
  }

  return (
    mime === 'image/jpeg' ||
    mime === 'image/png' ||
    mime === 'image/webp' ||
    /\.(jpe?g|png|webp)$/i.test(name)
  );
}

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Unable to encode image as WebP'))),
      'image/webp',
      quality
    );
  });

/**
 * Compresses an image and converts it into WebP format.
 * Modeled after amashope-dashboard/lib/optimizeImage.ts.
 */
export async function optimizeTaskImage(
  file: File,
  customOptions?: ImageOptimizationOptions
): Promise<File> {
  if (!isOptimizableImage(file)) {
    return file;
  }

  const { maxWidth, maxHeight, quality } = {
    ...DEFAULT_OPTIONS,
    ...customOptions,
  };

  try {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      bitmap = await createImageBitmap(file);
    }

    try {
      const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d', { alpha: true });
      if (!context) {
        console.warn('Canvas 2D context unavailable, proceeding with original file');
        return file;
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, width, height);

      const blob = await canvasToBlob(canvas, quality);

      // If original was already WebP and smaller, keep the original
      if (file.type === 'image/webp' && blob.size >= file.size) {
        return file;
      }

      const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
      return new File([blob], `${baseName}.webp`, {
        type: 'image/webp',
        lastModified: Date.now(),
      });
    } finally {
      bitmap.close();
    }
  } catch (error) {
    console.warn('Image optimization skipped due to error, proceeding with original file:', error);
    return file;
  }
}
