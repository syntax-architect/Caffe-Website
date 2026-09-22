import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useUI } from '../context/UIContext';

export const CartDrawer: React.FC = () => {
  const { items, isDrawerOpen, setIsDrawerOpen, updateQuantity, removeFromCart, cartTotal, clearCart } = useCart();
  const { showModal } = useUI();

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-surface-container-lowest/80 z-[100]"
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-surface border-l border-outline-variant/30 shadow-2xl z-[101] flex flex-col"
            data-lenis-prevent
          >
            {/* Header */}
            <div className="flex items-center justify-between p-space-md border-b border-outline-variant/30 bg-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D4AF37]">shopping_bag</span>
                <h2 className="font-headline-sm text-on-surface font-bold">Your Order</h2>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto min-h-0 p-space-md flex flex-col gap-space-sm">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-on-surface-variant gap-4">
                  <span className="material-symbols-outlined text-6xl opacity-50">remove_shopping_cart</span>
                  <p className="font-body-md">Your cart is empty.</p>
                  <button 
                    onClick={() => setIsDrawerOpen(false)}
                    className="mt-4 px-6 py-2 rounded-xl bg-primary-container text-[#231914] font-label-md font-bold"
                  >
                    Explore Menu
                  </button>
                </div>
              ) : (
                <AnimatePresence>
                  {items.map((item) => (
                    <motion.div 
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex gap-4 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20"
                    >
                      {item.image ? (
                        <img loading="lazy" src={item.image} alt={item.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-surface-container flex items-center justify-center shrink-0 border border-outline-variant/30">
                          <span className="material-symbols-outlined text-[#D4AF37]/50 text-2xl">restaurant</span>
                        </div>
                      )}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-headline-sm text-sm font-semibold text-on-surface truncate">{item.name}</h4>
                            <button onClick={() => removeFromCart(item.id)} className="text-on-surface-variant hover:text-error transition-colors shrink-0">
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                          <span className="font-sans text-sm text-tertiary font-semibold tracking-tight">₹{item.price}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2 gap-2">
                          <div className="flex items-center gap-1 sm:gap-3 bg-surface-container px-1 sm:px-2 py-1 rounded-lg shrink-0">
                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="text-on-surface hover:text-[#D4AF37]">
                              <span className="material-symbols-outlined text-sm">remove</span>
                            </button>
                            <span className="font-label-md text-on-surface w-4 text-center">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="text-on-surface hover:text-[#D4AF37]">
                              <span className="material-symbols-outlined text-sm">add</span>
                            </button>
                          </div>
                          <span className="font-label-md text-on-surface font-semibold">₹{item.price * item.quantity}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-space-md border-t border-outline-variant/30 bg-surface-container-low flex flex-col gap-4">
                <div className="flex justify-between items-center text-on-surface">
                  <span className="font-body-md text-on-surface-variant">Subtotal</span>
                  <span className="font-headline-sm font-bold">₹{cartTotal}</span>
                </div>
                <div className="flex justify-between items-center text-on-surface pb-4 border-b border-outline-variant/20">
                  <span className="font-body-md text-on-surface-variant">Taxes & Fees</span>
                  <span className="font-body-md">Calculated at checkout</span>
                </div>
                <div className="flex justify-between items-center text-on-surface pb-2">
                  <span className="font-headline-md font-bold">Total</span>
                  <span className="font-headline-md font-bold text-[#D4AF37]">₹{cartTotal}</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={clearCart}
                    className="px-4 py-3 rounded-xl border border-outline-variant hover:bg-surface-container transition-colors text-on-surface font-label-md font-bold"
                  >
                    Clear
                  </button>
                  <button 
                    className="flex-1 py-3 rounded-xl bg-[#D4AF37] text-[#231914] font-label-md font-bold  hover: transition-all"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      showModal(
                        'Checkout Unavailable',
                        'Online checkout is currently disabled while we integrate our delivery partners. Please visit the cafe or call us to place your order!'
                      );
                    }}
                  >
                    Checkout (₹{cartTotal})
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
