import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCcw, Upload, CheckCircle2 } from 'lucide-react';

interface ReceiptCameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  translate?: (text: string) => string;
}

export default function ReceiptCameraModal({ open, onClose, onCapture, translate }: ReceiptCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (open) {
      setError('');
      setActive(false);
      if (navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
          .then((stream) => {
            streamRef.current = stream;
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
            }
            setActive(true);
          })
          .catch((err) => {
            setError('Camera unavailable. Please use the upload option instead.');
          });
      } else {
        setError('Camera not supported on this device/browser. Please use the upload option instead.');
      }
    } else {
      stopStream();
    }
    return () => stopStream();
  }, [open]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    const maxW = 1280;
    const scale = Math.min(1, maxW / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    stopStream();
    onCapture(dataUrl);
    onClose();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onCapture(String(reader.result));
      onClose();
    };
    reader.readAsDataURL(file);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[#2d323e] text-white">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4" />
            <span className="text-xs font-black tracking-wider uppercase">Capture Payment Receipt</span>
          </div>
          <button onClick={() => { stopStream(); onClose(); }} className="p-1 hover:bg-white/10 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {error ? (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800">
              {error}
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {!active && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-semibold">
                  Starting camera...
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {!error && (
              <button
                onClick={capture}
                disabled={!active}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-brand text-white text-xs font-bold rounded-lg disabled:opacity-40"
              >
                <CheckCircle2 className="w-4 h-4" />
                Capture Photo
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-lg"
            >
              <Upload className="w-4 h-4" />
              Upload Receipt
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
          {active && !error && (
            <button
              onClick={() => {
                if (streamRef.current) {
                  streamRef.current.getTracks().forEach(t => t.stop());
                  setActive(false);
                  navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
                    .then((s) => { streamRef.current = s; if (videoRef.current) videoRef.current.srcObject = s; setActive(true); })
                    .catch(() => setError('Unable to restart camera.'));
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold text-gray-500 hover:text-brand"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Retry / Switch Camera
            </button>
          )}
          <p className="text-[10px] text-gray-400 font-semibold text-center">
            Hold the receipt / mobile money confirmation clearly in frame, then capture.
          </p>
        </div>
      </div>
    </div>
  );
}
