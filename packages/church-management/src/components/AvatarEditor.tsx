import React, { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check } from 'lucide-react';
import { AvatarTransform } from './memberData';

interface AvatarEditorProps {
  imageUrl: string;
  initialTransform?: AvatarTransform;
  onSave: (croppedImageUrl: string, transform: AvatarTransform) => void;
  onCancel: () => void;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

const AvatarEditor: React.FC<AvatarEditorProps> = ({ imageUrl, onSave, onCancel }) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  };

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) {
      onSave(imageUrl, { scale: 1, positionX: 0, positionY: 0 });
      return;
    }

    setIsProcessing(true);

    try {
      const image = imgRef.current;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('No 2d context');
      }

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      // Fixed pixel ratio of 1 to avoid massive canvas sizes on retina displays
      const pixelRatio = 1;

      const cropWidth = completedCrop.width * scaleX;
      const cropHeight = completedCrop.height * scaleY;

      // Ensure the canvas is never absurdly large (e.g. max 800x800)
      let finalWidth = cropWidth;
      let finalHeight = cropHeight;
      const MAX_SIZE = 800;

      if (finalWidth > MAX_SIZE) {
        const ratio = MAX_SIZE / finalWidth;
        finalWidth = MAX_SIZE;
        finalHeight *= ratio;
      }

      canvas.width = finalWidth * pixelRatio;
      canvas.height = finalHeight * pixelRatio;

      ctx.scale(pixelRatio, pixelRatio);
      ctx.imageSmoothingQuality = 'high';

      const cropX = completedCrop.x * scaleX;
      const cropY = completedCrop.y * scaleY;

      ctx.drawImage(
        image,
        cropX,
        cropY,
        cropWidth, // Read original width
        cropHeight, // Read original height
        0,
        0,
        finalWidth, // Write downscaled width
        finalHeight, // Write downscaled height
      );

      // Create circular crop mask
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      ctx.arc(finalWidth / 2, finalHeight / 2, Math.min(finalWidth, finalHeight) / 2, 0, 2 * Math.PI);
      ctx.fill();

      // Convert canvas to base64
      // Use PNG if we are doing circular transparency mask so corners are transparent
      // Or we can fill a background color and use JPEG. Since we already have a circular UI,
      // PNG is better to avoid white corners on dark backgrounds.

      // Wait, let's just make it a clean JPEG with a solid background matching our theme? No, PNG is safer for circles.
      const base64Image = canvas.toDataURL('image/png');

      onSave(base64Image, { scale: 1, positionX: 0, positionY: 0 });
    } catch (e) {
      console.error(e);
      onSave(imageUrl, { scale: 1, positionX: 0, positionY: 0 });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-semibold text-slate-800">Crop Profile Photo</h3>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-auto flex justify-center items-center bg-slate-100">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={1}
            circularCrop
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Crop me"
              onLoad={onImageLoad}
              style={{ maxHeight: '60vh', width: 'auto' }}
            />
          </ReactCrop>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <p className="text-sm text-slate-500">Drag the frame to crop</p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                'Saving...'
              ) : (
                <>
                  <Check className="h-4 w-4" /> Save Photo
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TransformedAvatar: React.FC<{
  src?: string;
  transform?: AvatarTransform;
  className?: string;
  alt?: string;
}> = ({ src, className, alt }) => {
  if (!src) return null;
  return (
    <img src={src} className={className} alt={alt || 'Avatar'} style={{ objectFit: 'cover', borderRadius: '50%' }} />
  );
};

export default AvatarEditor;
