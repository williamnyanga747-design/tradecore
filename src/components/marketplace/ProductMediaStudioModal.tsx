import React, { useState, useEffect } from 'react';
import {
  X, Sparkles, Video, Play, Download, Check, RefreshCw, Wand2,
  Sliders, Eye, Film, Layers, CheckCircle2, ShieldAlert
} from 'lucide-react';
import {
  processStudioProductImage,
  generateProductSpinVideo,
  VIDEO_PRESETS,
  VideoPresetType,
  StudioImageResult
} from '../../utils/productMediaStudio';
import { toast } from '../../utils/toast';

interface ProductMediaStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  productImage: string;
  productName: string;
  onApplyImage: (newImageDataUrl: string) => void;
  onApplyVideo: (videoUrl: string) => void;
  translate?: (text: string) => string;
  initialTab?: 'image_studio' | 'video_studio';
}

export default function ProductMediaStudioModal({
  isOpen,
  onClose,
  productImage,
  productName,
  onApplyImage,
  onApplyVideo,
  translate: t = (s: string) => s,
  initialTab = 'image_studio'
}: ProductMediaStudioModalProps) {
  const [activeTab, setActiveTab] = useState<'image_studio' | 'video_studio'>(initialTab);

  // Sync initial tab when modal opens
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Image Studio States
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [processedImage, setProcessedImage] = useState<StudioImageResult | null>(null);
  const [shadowIntensity, setShadowIntensity] = useState<number>(0.35);
  const [showOriginal, setShowOriginal] = useState(false);

  // Video Studio States
  const [selectedPreset, setSelectedPreset] = useState<VideoPresetType>('ecommerce_360');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoStatusMessage, setVideoStatusMessage] = useState('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedVideoBlob, setGeneratedVideoBlob] = useState<Blob | null>(null);

  // Run initial image studio enhancement when modal opens
  useEffect(() => {
    if (isOpen && productImage && !processedImage) {
      handleProcessImage();
    }
  }, [isOpen, productImage]);

  const handleProcessImage = async (customShadow?: number) => {
    if (!productImage) return;
    setIsProcessingImage(true);
    try {
      const res = await processStudioProductImage(productImage, {
        shadowIntensity: customShadow !== undefined ? customShadow : shadowIntensity,
        enhanceStudioLighting: true,
        targetSize: 1000
      });
      setProcessedImage(res);
      toast.success(t('Image converted to pure white #FFFFFF with soft studio shadow!'));
    } catch (err: any) {
      toast.error(err?.message || t('Failed to process product image'));
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleApplyImage = () => {
    if (processedImage?.dataUrl) {
      onApplyImage(processedImage.dataUrl);
      toast.success(t('Studio white #FFFFFF product photo applied!'));
      onClose();
    }
  };

  const handleGenerateVideo = async () => {
    const sourceImg = processedImage?.dataUrl || productImage;
    if (!sourceImg) {
      toast.error(t('Please load or process a product image first.'));
      return;
    }

    setIsGeneratingVideo(true);
    setVideoProgress(0);
    setVideoStatusMessage(t('Initializing 360° turntable engine...'));

    try {
      const result = await generateProductSpinVideo(sourceImg, selectedPreset, (pct, msg) => {
        setVideoProgress(pct);
        setVideoStatusMessage(msg);
      });

      setGeneratedVideoUrl(result.url);
      setGeneratedVideoBlob(result.blob);
      toast.success(t('360° product video generated successfully!'));
    } catch (err: any) {
      toast.error(err?.message || t('Failed to generate product spin video.'));
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleApplyVideo = () => {
    if (generatedVideoUrl) {
      onApplyVideo(generatedVideoUrl);
      toast.success(t('360° video attached to product!'));
      onClose();
    }
  };

  const handleDownloadVideo = () => {
    if (!generatedVideoBlob || !generatedVideoUrl) return;
    const a = document.createElement('a');
    a.href = generatedVideoUrl;
    a.download = `${productName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_360_spin.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(t('Video download started!'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-indigo-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand to-cyan-400 flex items-center justify-center text-white shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight">TradeCore Image & Video Studio</h2>
                <span className="text-[10px] bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  E-Commerce 4K
                </span>
              </div>
              <p className="text-xs text-indigo-200">
                {productName ? `Enhancing: ${productName}` : 'Product Media Enhancement Studio'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Mode Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('image_studio')}
            className={`px-5 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border-t-2 ${
              activeTab === 'image_studio'
                ? 'bg-white text-slate-900 border-brand shadow-xs'
                : 'text-slate-500 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Wand2 className="w-4 h-4 text-brand" />
            <span>AI Studio Image Editor (#FFFFFF + Soft Shadow)</span>
          </button>
          <button
            onClick={() => setActiveTab('video_studio')}
            className={`px-5 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border-t-2 ${
              activeTab === 'video_studio'
                ? 'bg-white text-slate-900 border-cyan-500 shadow-xs'
                : 'text-slate-500 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Film className="w-4 h-4 text-cyan-600" />
            <span>360° Product Video & Spin Animation</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* TAB 1: AI STUDIO IMAGE EDITOR */}
          {activeTab === 'image_studio' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Preview Canvas Display */}
              <div className="lg:col-span-7 flex flex-col items-center">
                <div className="w-full aspect-square max-w-[420px] rounded-2xl border-2 border-slate-200 overflow-hidden shadow-lg bg-white relative flex items-center justify-center p-4">
                  {isProcessingImage ? (
                    <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                      <RefreshCw className="w-10 h-10 text-brand animate-spin" />
                      <div className="text-xs font-bold text-slate-700">Removing background & adding soft studio shadow...</div>
                      <div className="text-[10px] text-slate-400 font-mono">Enhancing to 1000x1000px pure white #FFFFFF</div>
                    </div>
                  ) : showOriginal ? (
                    <img
                      src={productImage}
                      alt="Original Product"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : processedImage?.dataUrl ? (
                    <img
                      src={processedImage.dataUrl}
                      alt="Processed Product"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <img
                      src={productImage}
                      alt="Product"
                      className="max-h-full max-w-full object-contain"
                    />
                  )}

                  {/* Corner Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="bg-slate-900/80 backdrop-blur-md text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded-full">
                      {showOriginal ? 'ORIGINAL' : 'STUDIO #FFFFFF'}
                    </span>
                    {!showOriginal && processedImage && (
                      <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                        1000x1000 4K
                      </span>
                    )}
                  </div>

                  {/* Preview Toggle Button */}
                  {processedImage && (
                    <button
                      type="button"
                      onMouseDown={() => setShowOriginal(true)}
                      onMouseUp={() => setShowOriginal(false)}
                      onTouchStart={() => setShowOriginal(true)}
                      onTouchEnd={() => setShowOriginal(false)}
                      className="absolute bottom-3 right-3 px-3 py-1.5 bg-slate-900/85 hover:bg-slate-900 text-white text-[10px] font-bold rounded-xl shadow backdrop-blur-md flex items-center gap-1.5 transition select-none cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Hold to see original</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 text-center mt-3 max-w-sm">
                  ✓ Pure white background #FFFFFF • ✓ Soft natural ground shadow • ✓ Preserves product shape & labels • ✓ Amazon & Shoprite Standard
                </p>
              </div>

              {/* Controls & Specifications Column */}
              <div className="lg:col-span-5 space-y-5">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-brand" />
                    <span>Studio Enhancer Parameters</span>
                  </h4>

                  {/* Soft Shadow Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">Soft Shadow Depth</span>
                      <span className="font-mono text-slate-500">{Math.round(shadowIntensity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.6"
                      step="0.05"
                      value={shadowIntensity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setShadowIntensity(val);
                        handleProcessImage(val);
                      }}
                      className="w-full accent-brand cursor-pointer"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 space-y-2 text-[11px] text-slate-600 font-medium">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Background: Pure White #FFFFFF (255, 255, 255)</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Shadow: Diffuse Elliptical Ground Gradient</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Output: 1000x1000px High-Detail Square Canvas</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Labels: 100% original readability, zero distortion</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleProcessImage()}
                    disabled={isProcessingImage}
                    className="w-full py-2 px-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isProcessingImage ? 'animate-spin' : ''}`} />
                    <span>Re-process & Re-center Product</span>
                  </button>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={handleApplyImage}
                    disabled={!processedImage || isProcessingImage}
                    className="w-full py-3 px-4 bg-brand hover:bg-brand-hover text-white text-xs font-black rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>Apply & Save to Product Photos</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full py-2 px-3 text-slate-500 hover:text-slate-800 text-xs font-bold transition text-center"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 360° PRODUCT VIDEO & ANIMATION STUDIO */}
          {activeTab === 'video_studio' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Video Player Display */}
              <div className="lg:col-span-7 flex flex-col items-center">
                <div className={`w-full ${selectedPreset === 'tiktok_916' ? 'aspect-[9/16] max-w-[280px]' : 'aspect-square max-w-[420px]'} rounded-2xl border-2 border-slate-200 overflow-hidden shadow-xl bg-black relative flex items-center justify-center`}>
                  {isGeneratingVideo ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-900/90 text-white w-full h-full">
                      <div className="w-12 h-12 rounded-full border-3 border-cyan-400 border-t-transparent animate-spin"></div>
                      <div className="text-sm font-black text-white">{videoProgress}% Complete</div>
                      <div className="text-xs text-cyan-300 font-mono max-w-xs">{videoStatusMessage}</div>
                      <div className="w-48 bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                        <div className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-full transition-all duration-150" style={{ width: `${videoProgress}%` }}></div>
                      </div>
                    </div>
                  ) : generatedVideoUrl ? (
                    <video
                      src={generatedVideoUrl}
                      controls
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
                      <Film className="w-10 h-10 text-slate-600 mb-1" />
                      <div className="text-xs font-bold text-slate-300">Ready to animate 360° spin video</div>
                      <div className="text-[11px] text-slate-500 max-w-xs">
                        Select a preset on the right and click "Generate 360° Video"
                      </div>
                    </div>
                  )}

                  {generatedVideoUrl && !isGeneratingVideo && (
                    <div className="absolute top-3 left-3 bg-emerald-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                      360° LOOP READY
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 text-center mt-3 max-w-md">
                  High-definition 30fps canvas-rendered video. Smooth horizontal rotation, soft tracking ground shadow, and centered camera framing.
                </p>
              </div>

              {/* Video Presets & Action Column */}
              <div className="lg:col-span-5 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                    Select Video Animation Preset:
                  </label>

                  <div className="space-y-2">
                    {(Object.keys(VIDEO_PRESETS) as VideoPresetType[]).map((key) => {
                      const p = VIDEO_PRESETS[key];
                      const isSelected = selectedPreset === key;
                      return (
                        <div
                          key={key}
                          onClick={() => setSelectedPreset(key)}
                          className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex flex-col gap-1 ${
                            isSelected
                              ? 'border-cyan-500 bg-cyan-50/60 shadow-sm'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900">{p.name}</span>
                            <span className="text-[10px] bg-slate-100 font-mono font-bold text-slate-600 px-2 py-0.5 rounded-md">
                              {p.aspectRatio} • {p.durationSeconds}s
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">{p.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Video Generation Trigger */}
                <div className="pt-2 space-y-2">
                  <button
                    onClick={handleGenerateVideo}
                    disabled={isGeneratingVideo}
                    className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:brightness-110 text-white text-xs font-black rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingVideo ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Rendering 360° Video ({videoProgress}%)...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Generate 360° Product Video</span>
                      </>
                    )}
                  </button>

                  {generatedVideoUrl && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={handleApplyVideo}
                        className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Use as Product Video</span>
                      </button>
                      <button
                        onClick={handleDownloadVideo}
                        className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Video</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
