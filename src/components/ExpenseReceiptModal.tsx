import React, { useState, useRef } from 'react';
import { Expense } from '../types';
import { formatMoney } from '../utils/format';
import { compressImageFile, formatByteSize } from '../utils/imageCompression';
import { toast } from '../utils/toast';
import {
  X,
  Upload,
  Camera,
  Trash2,
  Download,
  Printer,
  FileText,
  CheckCircle2,
  Calendar,
  Building,
  CreditCard,
  ZoomIn,
  RefreshCw,
  Receipt
} from 'lucide-react';
import ReceiptCameraModal from './ReceiptCameraModal';

interface ExpenseReceiptModalProps {
  expense: Expense | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveReceipt: (expenseId: number, receiptUrl: string, receiptName?: string) => Promise<void> | void;
  onRemoveReceipt: (expenseId: number) => Promise<void> | void;
  currency: string;
  exchangeRate: number;
  translate: (t: string) => string;
}

export default function ExpenseReceiptModal({
  expense,
  isOpen,
  onClose,
  onSaveReceipt,
  onRemoveReceipt,
  currency,
  exchangeRate,
  translate: t
}: ExpenseReceiptModalProps) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen || !expense) return null;

  const currentReceipt = selectedFileUrl || expense.receiptUrl || '';
  const currentReceiptName = selectedFileName || expense.receiptName || 'expense_receipt.png';

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error(t('File is too large. Maximum size is 15MB.'));
      return;
    }

    setIsUploading(true);
    try {
      if (file.type.startsWith('image/')) {
        const compressed = await compressImageFile(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.82 });
        setSelectedFileUrl(compressed.dataUrl);
        setSelectedFileName(file.name);
        toast.success(
          `${t('Receipt compressed')} (${formatByteSize(compressed.originalBytes)} → ${formatByteSize(compressed.compressedBytes)})`
        );
      } else {
        // PDF or other document
        const reader = new FileReader();
        reader.onload = () => {
          setSelectedFileUrl(String(reader.result || ''));
          setSelectedFileName(file.name);
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
        return;
      }
    } catch {
      toast.error(t('Could not process this file. Please try another image.'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleCameraCapture = (dataUrl: string) => {
    setSelectedFileUrl(dataUrl);
    setSelectedFileName(`camera_receipt_${Date.now()}.jpg`);
    toast.success(t('Photo captured from camera.'));
  };

  const handleSave = async () => {
    if (!selectedFileUrl) {
      toast.error(t('Please select or capture a receipt first.'));
      return;
    }
    await onSaveReceipt(expense.id, selectedFileUrl, selectedFileName || 'receipt.jpg');
    toast.success(t('Expense receipt saved and linked successfully.'));
    setSelectedFileUrl('');
    setSelectedFileName('');
    onClose();
  };

  const handleRemove = async () => {
    if (confirm(t('Are you sure you want to remove this receipt from the expense record?'))) {
      await onRemoveReceipt(expense.id);
      setSelectedFileUrl('');
      setSelectedFileName('');
      toast.success(t('Receipt detached from expense.'));
      onClose();
    }
  };

  const handleDownload = () => {
    if (!currentReceipt) return;
    const a = document.createElement('a');
    a.href = currentReceipt;
    a.download = `${expense.expenseNumber}_receipt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    if (!currentReceipt) return;
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`
        <html>
          <head>
            <title>${expense.expenseNumber} - Receipt</title>
            <style>
              body { font-family: sans-serif; padding: 20px; text-align: center; }
              .header { margin-bottom: 20px; text-align: left; }
              img { max-width: 100%; height: auto; border: 1px solid #ddd; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>Expense Receipt: ${expense.expenseNumber}</h2>
              <p><strong>Category:</strong> ${expense.category} | <strong>Amount:</strong> ${formatMoney(expense.amount, currency, exchangeRate)}</p>
              <p><strong>Date:</strong> ${expense.date} | <strong>Description:</strong> ${expense.description}</p>
            </div>
            <img src="${currentReceipt}" onload="window.print(); window.close();" />
          </body>
        </html>
      `);
      printWin.document.close();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-gray-900 font-mono">
                    {expense.expenseNumber}
                  </h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                    {expense.category}
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  {t('Expense Receipt Documentation & Audit Proof')}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedFileUrl('');
                setSelectedFileName('');
                onClose();
              }}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Expense Summary Pill */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-gray-50/80 p-3 rounded-xl border border-gray-100 text-xs">
            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {t('Amount')}
              </span>
              <span className="font-extrabold text-gray-900 text-sm">
                {formatMoney(expense.amount, currency, exchangeRate)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {t('Date')}
              </span>
              <span className="font-semibold text-gray-700 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3 text-gray-400" />
                {expense.date}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {t('Method')}
              </span>
              <span className="font-semibold text-gray-700 flex items-center gap-1 mt-0.5">
                <CreditCard className="w-3 h-3 text-gray-400" />
                {expense.paymentMethod}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {t('Receipt Status')}
              </span>
              {currentReceipt ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t('Attached')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 mt-0.5">
                  {t('No Receipt')}
                </span>
              )}
            </div>
            <div className="col-span-2 sm:col-span-4 pt-1.5 border-t border-gray-200/60 text-gray-600">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1.5">
                {t('Description')}:
              </span>
              <span className="font-medium text-gray-800">{expense.description}</span>
            </div>
          </div>

          {/* Receipt View or Upload Section */}
          {currentReceipt ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  {currentReceiptName}
                  {expense.receiptUploadedAt && (
                    <span className="text-[10px] text-gray-400 font-normal">
                      ({new Date(expense.receiptUploadedAt).toLocaleDateString()})
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setZoomed(!zoomed)}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
                    title={zoomed ? t('Zoom out') : t('Zoom in')}
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleDownload}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
                    title={t('Download Receipt')}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handlePrint}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
                    title={t('Print Receipt')}
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Receipt Preview Box */}
              <div
                className={`bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center border border-gray-200 relative transition-all duration-200 ${
                  zoomed ? 'max-h-[500px]' : 'max-h-[300px]'
                }`}
              >
                {currentReceipt.startsWith('data:image/') || currentReceipt.startsWith('http') ? (
                  <img
                    src={currentReceipt}
                    alt="Expense receipt"
                    className="max-h-full max-w-full object-contain cursor-pointer"
                    onClick={() => setZoomed(!zoomed)}
                  />
                ) : (
                  <div className="p-8 text-center text-white space-y-2">
                    <FileText className="w-12 h-12 mx-auto text-amber-400" />
                    <p className="text-xs font-semibold">{currentReceiptName}</p>
                    <button
                      onClick={handleDownload}
                      className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold"
                    >
                      {t('Download Document')}
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons below preview */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleRemove}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {t('Remove Receipt')}
                </button>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInput}
                    accept="image/*,application/pdf"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> {t('Replace')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" /> {t('Camera')}
                  </button>
                  {selectedFileUrl && (
                    <button
                      type="button"
                      onClick={handleSave}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand hover:opacity-90 rounded-lg transition shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> {t('Save Changes')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Upload / Capture Section */
            <div className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInput}
                accept="image/*,application/pdf"
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 hover:border-brand rounded-2xl p-8 text-center cursor-pointer transition bg-gray-50/50 hover:bg-brand/5 group"
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition duration-200 mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-gray-800">
                  {t('Click to upload receipt document or photo')}
                </h4>
                <p className="text-xs text-gray-500 font-medium max-w-sm mx-auto mt-1">
                  {t('Supports PNG, JPG, JPEG, WebP and PDF up to 15MB. Automatically compressed for cloud storage.')}
                </p>
              </div>

              <div className="flex items-center justify-center gap-3">
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                  {t('or')}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="w-full py-3 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-800 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <Camera className="w-4 h-4 text-brand" />
                {t('Take Photo with Live Camera / Phone')}
              </button>
            </div>
          )}

          {/* Footer Close */}
          <div className="flex justify-end pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setSelectedFileUrl('');
                setSelectedFileName('');
                onClose();
              }}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
            >
              {t('Close')}
            </button>
          </div>
        </div>
      </div>

      {/* Live Camera Modal */}
      {cameraOpen && (
        <ReceiptCameraModal
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onCapture={handleCameraCapture}
          translate={t}
        />
      )}
    </>
  );
}
