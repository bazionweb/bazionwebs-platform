/**
 * Compresses an image file in the browser using the HTML5 Canvas API.
 * This significantly reduces the size of the image before uploading to save database/storage space.
 *
 * @param file The original image File object from an input type="file"
 * @param maxWidth The maximum width of the output image (default: 400px)
 * @param maxHeight The maximum height of the output image (default: 400px)
 * @param quality Compression quality from 0 to 1 (default: 0.7 for JPEG)
 * @returns A promise that resolves to the compressed base64 string
 */
export const compressImage = (file: File, maxWidth = 400, maxHeight = 400, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw image onto canvas with new dimensions
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG and get base64 string
        // We always output JPEG for avatars as it offers much better compression for photos than PNG
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image into canvas'));
      };
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
  });
};
