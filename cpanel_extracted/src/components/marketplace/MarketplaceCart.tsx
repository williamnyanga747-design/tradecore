import React from 'react';
import { X, Minus, Plus, Trash2, ShoppingCart, ArrowRight } from 'lucide-react';
import { Company } from '../../types';
import { getPublicTheme, PublicTheme } from '../../utils/publicTheme';
import { CartLine, TZS, TFunc } from './MarketplaceShared';

interface Props {
  theme: PublicTheme;
  t: TFunc;
  open: boolean;
  onClose: () => void;
  company: Company | null;
  cartItems: CartLine[];
  onUpdateQty: (productId: number, qty: number) => void;
  onRemove: (productId: number) => void;
  onClear: () => void;
  onCheckout: () => void;
}

export default function MarketplaceCart({
  theme, t, open, onClose, company, cartItems, onUpdateQty, onRemove, onClear, onCheckout
}: Props) {
  const th = getPublicTheme(theme);
  const total = cartItems.reduce((s, i) => s + i.quantity * i.product.price, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className={`absolute right-0 top-0 h-full w-full max-w-md ${th.card} shadow-2xl flex flex-col`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${th.border}`}>
          <div className="flex items-center gap-2">
            <ShoppingCart className={`w-5 h-5 ${th.statValue}`} />
            <div>
              <div className={`text-sm font-black ${th.strongText}`}>{t('Your Cart')}</div>
              <div className={`text-[10px] ${th.textDim} font-semibold`}>{company?.name || t('Select a store')}</div>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${th.textMuted} hover:bg-white/10 cursor-pointer`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {cartItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <ShoppingCart className={`w-12 h-12 mb-3 ${th.textDim}`} />
            <div className={`text-sm font-black ${th.strongText}`}>{t('Cart is empty')}</div>
            <div className={`text-[11px] ${th.textMuted} font-semibold mt-1`}>{t('Add some products to get started.')}</div>
            <button onClick={onClose} className={`mt-4 px-5 py-2.5 text-[11px] font-black rounded-xl ${th.btnPrimary} ${th.btnPrimaryText} cursor-pointer`}>
              {t('Browse Products')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cartItems.map(({ product, quantity }) => (
                <div key={product.id} className={`flex gap-3 p-3 rounded-2xl border ${th.cardBorder} ${th.card}`}>
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-600 text-white text-xl font-black">
                        {(product.name || '-').charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-black ${th.strongText} line-clamp-1`}>{product.name}</div>
                    <div className={`text-[10px] ${th.textDim} font-semibold mt-0.5`}>{TZS(product.price)} {t('each')}</div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onUpdateQty(product.id, quantity - 1)}
                          className={`w-6 h-6 rounded-md flex items-center justify-center ${th.btnSecondary} ${th.btnSecondaryText} cursor-pointer`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className={`w-7 text-center text-xs font-black ${th.strongText}`}>{quantity}</span>
                        <button
                          onClick={() => onUpdateQty(product.id, quantity + 1)}
                          disabled={(product.stockQuantity || 0) <= quantity}
                          className={`w-6 h-6 rounded-md flex items-center justify-center ${th.btnSecondary} ${th.btnSecondaryText} cursor-pointer disabled:opacity-30`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black ${th.statValue}`}>{TZS(quantity * product.price)}</span>
                        <button onClick={() => onRemove(product.id)} className={`p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 cursor-pointer`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className={`px-5 py-4 border-t ${th.border} space-y-3`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] ${th.textMuted} font-bold uppercase tracking-wider`}>{t('Total')}</span>
                <span className={`text-xl font-black ${th.statValue}`}>{TZS(total)}</span>
              </div>
              <button
                onClick={onCheckout}
                className={`w-full flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-black rounded-2xl transition cursor-pointer ${th.btnPrimary} ${th.btnPrimaryText}`}
              >
                {t('Proceed to Checkout')} <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={onClear} className={`w-full text-center text-[10px] ${th.textDim} font-bold hover:underline cursor-pointer`}>
                {t('Clear Cart')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
