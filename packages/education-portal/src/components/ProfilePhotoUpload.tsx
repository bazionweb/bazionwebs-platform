import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from '../shims/react-image-crop';

interface ProfilePhotoUploadProps {
  currentPhoto?: string | null;
  onUpload: (base64Photo: string) => Promise<void>;
  buttonClass?: string;
}

export function ProfilePhotoUpload({ currentPhoto, onUpload, buttonClass = "btn btn-primary" }: ProfilePhotoUploadProps) {
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const imgRef = useRef<HTMLImageElement>(null);

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setError(null);
      const file = e.target.files[0];
      
      if (file.size > 5 * 1024 * 1024) {
        setError('Image is too large (max 5MB)');
        return;
      }
      
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
      });
      reader.readAsDataURL(file);
    }
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
    
    const crop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
      width,
      height
    );
    setCrop(crop);
  }

  const handleUpload = async () => {
    if (!imgRef.current || !crop) return;

    setLoading(true);
    setError(null);
    try {
      // Create canvas to draw the cropped image
      const canvas = document.createElement('canvas');
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
      
      canvas.width = crop.width;
      canvas.height = crop.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2d context');

      ctx.drawImage(
        imgRef.current,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width,
        crop.height
      );

      // Convert to base64 JPEG
      const base64Image = canvas.toDataURL('image/jpeg', 0.8);
      
      await onUpload(base64Image);
      
      // Reset UI on success
      setImgSrc('');
      setCrop(undefined);
    } catch (err: any) {
      setError(err.message || 'Failed to crop and upload photo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {!imgSrc && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {currentPhoto ? (
            <img 
              src={currentPhoto} 
              alt="Profile" 
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
            />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No Photo
            </div>
          )}
          <div>
            <label className={buttonClass} style={{ cursor: 'pointer', display: 'inline-block' }}>
              Select New Photo
              <input 
                type="file" 
                accept="image/jpeg,image/png,image/webp" 
                style={{ display: 'none' }}
                onChange={onSelectFile}
              />
            </label>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              JPEG, PNG or WebP. Max 5MB.
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: '0.9rem', padding: '0.5rem', background: 'var(--danger-light)', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {imgSrc && (
        <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <h4 style={{ marginBottom: '1rem' }}>Crop your photo</h4>
          <div style={{ display: 'flex', justifyContent: 'center', background: '#000', borderRadius: '4px', overflow: 'hidden' }}>
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              aspect={1}
              circularCrop
            >
              <img
                ref={imgRef}
                src={imgSrc}
                onLoad={onImageLoad}
                style={{ maxHeight: '60vh', objectFit: 'contain' }}
                alt="Upload preview"
              />
            </ReactCrop>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={() => setImgSrc('')}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleUpload}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Photo'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
