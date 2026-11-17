/**
 * BMI UMS — Real QR Code Scanner
 *
 * Uses jsQR to decode QR codes from:
 *   1. Live camera feed (requestAnimationFrame loop)
 *   2. Uploaded image files
 *
 * Passes the raw decoded string to onScan — the caller (VerificationPage)
 * is responsible for parsing the payload via parseQRPayload().
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import jsQR from '../shims/jsqr';
import {
  Camera,
  X,
  RotateCcw,
  Upload,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from '../shims/lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose, isOpen }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string>("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment",
  );
  const [scanning, setScanning] = useState(false);
  const [found, setFound]   = useState(false);
  const [uploading, setUploading] = useState(false);

  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Camera lifecycle ─────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setError("");
    setFound(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setHasPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
      }
    } catch { setHasPermission(false);
      setError("Camera access denied. Please allow camera access and try again.");
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return stopCamera;
  }, [isOpen, facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── jsQR scan loop (rAF) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!scanning) return;

    const tick = () => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code?.data) {
        setFound(true);
        setScanning(false);
        stopCamera();
        // Small delay so the "found" flash is visible before closing
        setTimeout(() => onScan(code.data), 300);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scanning, onScan, stopCamera]);

  // ── Image upload path ─────────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) { setUploading(false); URL.revokeObjectURL(objectUrl); return; }
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx)  { setUploading(false); URL.revokeObjectURL(objectUrl); return; }

      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });

      URL.revokeObjectURL(objectUrl);
      setUploading(false);

      if (code?.data) {
        setFound(true);
        setTimeout(() => onScan(code.data), 300);
      } else {
        setError("No QR code found in this image. Please try a clearer photo.");
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setUploading(false);
      setError("Could not read the image file.");
    };
    img.src = objectUrl;

    // Reset file input so the same file can be selected again
    e.target.value = "";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">

        {/* Header */}
        <div className="bg-[#4B0082] text-white p-4 flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Camera size={20} />
            Scan BMI Document QR Code
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-all"
            aria-label="Close scanner"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* Permission pending */}
          {hasPermission === null && (
            <div className="text-center py-10">
              <Loader2 size={40} className="mx-auto text-[#4B0082] animate-spin mb-4" />
              <p className="text-gray-600 font-medium">Requesting camera access…</p>
            </div>
          )}

          {/* Permission denied */}
          {hasPermission === false && (
            <div className="text-center py-8">
              <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
              <p className="text-red-600 font-semibold mb-2">Camera Access Required</p>
              <p className="text-sm text-gray-600 mb-4">{error }</p>
              <button
                onClick={startCamera}
                className="px-5 py-2 bg-[#4B0082] text-white rounded-lg hover:bg-purple-700 transition-all font-semibold"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Camera view */}
          {hasPermission === true && (
            <div className="space-y-4">
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />

                {/* Scan frame overlay */}
                {!found && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-56 h-56 relative">
                      {/* Corner brackets */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#FFD700] rounded-tl-md" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#FFD700] rounded-tr-md" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#FFD700] rounded-bl-md" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#FFD700] rounded-br-md" />
                      {/* Scanning line */}
                      {scanning && (
                        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#FFD700] opacity-80 animate-pulse" />
                      )}
                    </div>
                  </div>
                )}

                {/* Found flash */}
                {found && (
                  <div className="absolute inset-0 bg-emerald-500/40 flex items-center justify-center">
                    <CheckCircle2 size={72} className="text-white drop-shadow-xl" />
                  </div>
                )}

                {/* Status badge */}
                <div className="absolute top-3 left-3">
                  {scanning && (
                    <span className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      Scanning…
                    </span>
                  )}
                  {found && (
                    <span className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      <CheckCircle2 size={12} /> QR Found!
                    </span>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setFacingMode(f => f === "user" ? "environment" : "user")}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all text-sm font-medium"
                  title="Flip camera"
                >
                  <RotateCcw size={16} /> Flip Camera
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 bg-[#4B0082] text-white hover:bg-purple-700 rounded-lg transition-all text-sm font-medium disabled:opacity-60"
                  title="Upload image with QR code"
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  Upload Image
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              <p className="text-center text-xs text-gray-500">
                Point the camera at the QR code on the printed BMI document.
                <br />
                Or upload a photo of the document.
              </p>
            </div>
          )}
        </div>

        {/* Hidden elements */}
        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default QRScanner;









