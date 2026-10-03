import { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useCartSafe } from './CartContext';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastOptions {
  title?: string;
  message: string;
  subtext?: string;
  type?: ToastType;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

export type ToastInput = string | ToastOptions;

interface ActiveToast extends ToastOptions {
  id: string;
  duration: number;
}

interface UIContextType {
  showModal: (title: string, content: string | ReactNode) => void;
  closeModal: () => void;
  showToast: (input: ToastInput, options?: Partial<ToastOptions>) => void;
  dismissToast: () => void;
  isReservationOpen: boolean;
  setIsReservationOpen: (value: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

const normalizeToast = (input: ToastInput, options?: Partial<ToastOptions>): ActiveToast => {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  if (typeof input === 'string') {
    const addMatch = input.match(/^Added\s+(.+?)\s+to\s+(?:order|cart)$/i);
    if (addMatch) {
      return {
        id,
        title: options?.title || 'Added to Order',
        message: addMatch[1],
        subtext: options?.subtext,
        type: options?.type || 'success',
        actionLabel: options?.actionLabel || 'View Order',
        onAction: options?.onAction,
        duration: options?.duration || 4500,
      };
    }
    return {
      id,
      title: options?.title || 'Notice',
      message: input,
      subtext: options?.subtext,
      type: options?.type || 'info',
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
      duration: options?.duration || 4000,
    };
  }

  const duration = input.duration ?? options?.duration ?? 4500;
  return {
    id,
    title: input.title || options?.title || (input.type === 'error' ? 'Notice' : 'Added to Order'),
    message: input.message,
    subtext: input.subtext ?? options?.subtext,
    type: input.type || options?.type || 'success',
    actionLabel: input.actionLabel ?? options?.actionLabel ?? 'View Order',
    onAction: input.onAction ?? options?.onAction,
    duration,
  };
};

interface ToastNotificationProps {
  toast: ActiveToast;
  onDismiss: () => void;
  cartCount: number;
  onOpenCart?: () => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({
  toast,
  onDismiss,
  cartCount,
  onOpenCart,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef<number | null>(null);
  const remainingRef = useRef(toast.duration);

  useEffect(() => {
    if (isPaused) return;

    startTimeRef.current = Date.now();
    const intervalTime = 50;

    const timer = setInterval(() => {
      const start = startTimeRef.current ?? Date.now();
      const elapsed = Date.now() - start;
      const timeLeft = Math.max(0, remainingRef.current - elapsed);
      setProgress((timeLeft / toast.duration) * 100);

      if (timeLeft <= 0) {
        clearInterval(timer);
        onDismiss();
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPaused, toast.duration, onDismiss]);

  const handleMouseEnter = () => {
    if (startTimeRef.current !== null) {
      const elapsed = Date.now() - startTimeRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    }
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
  };

  const handleActionClick = () => {
    if (toast.onAction) {
      toast.onAction();
    } else if (onOpenCart) {
      onOpenCart();
    }
    onDismiss();
  };

  const iconName = {
    success: 'check',
    info: 'local_cafe',
    warning: 'priority_high',
    error: 'close',
  }[toast.type || 'success'];

  const isQrPageWithCart =
    typeof window !== 'undefined' &&
    window.location.pathname.startsWith('/qr') &&
    cartCount > 0;

  return (
    <aside
      role="status"
      aria-live="polite"
      key={toast.id}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`fixed left-4 right-4 sm:left-auto sm:right-6 max-w-sm sm:max-w-[390px] mx-auto sm:mx-0 z-[125] pointer-events-auto touch-manipulation transition-all duration-300 ease-out animate-fade-in ${
        isQrPageWithCart
          ? 'bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-28'
          : 'bottom-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))] sm:bottom-6'
      }`}
    >
      <div className="relative overflow-hidden rounded-2xl bg-[#18110D]/95 backdrop-blur-xl border border-[#D4AF37]/35 shadow-[0_20px_45px_rgba(0,0,0,0.7),0_0_24px_rgba(212,175,55,0.12)] p-4 flex flex-col gap-3 group text-on-surface">
        {/* Top subtle golden shimmer hairline */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent pointer-events-none" />

        {/* Header row: Icon, text description, and close button */}
        <div className="flex items-start gap-3.5">
          {/* Custom refined emblem */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37]/25 to-[#9d4300]/20 border border-[#D4AF37]/45 flex items-center justify-center text-[#D4AF37] shadow-[0_0_14px_rgba(212,175,55,0.22)] shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[20px] font-semibold select-none">
              {iconName}
            </span>
          </div>

          {/* Toast text */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">
                {toast.title}
              </span>
              <span className="w-1 h-1 rounded-full bg-[#D4AF37]/40" />
              <span className="text-[10px] text-on-surface-variant/70 uppercase tracking-wider">
                Just now
              </span>
            </div>

            <h4
              className="font-serif text-[15px] sm:text-base text-[#F4ECE1] font-medium leading-snug truncate mt-0.5"
              title={toast.message}
            >
              {toast.message}
            </h4>

            {toast.subtext && (
              <p className="text-xs text-on-surface-variant/80 truncate mt-0.5">
                {toast.subtext}
              </p>
            )}
          </div>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={onDismiss}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-on-surface/60 hover:text-on-surface flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Action Bar: Cart indicator & View Order CTA */}
        <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.08] gap-3">
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant/90">
            <span className="material-symbols-outlined text-sm text-[#D4AF37]">shopping_bag</span>
            <span>
              {cartCount > 0
                ? `${cartCount} item${cartCount > 1 ? 's' : ''} in cart`
                : 'Item added'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleActionClick}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#C39F2B] hover:from-[#F5D058] hover:to-[#D4AF37] active:scale-95 text-[#1A120E] text-xs font-semibold tracking-wide shadow-[0_2px_10px_rgba(212,175,55,0.25)] transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>{toast.actionLabel || 'View Order'}</span>
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </button>
        </div>

        {/* Auto-dismiss timer progress bar */}
        <div className="absolute bottom-0 inset-x-0 h-[2px] bg-white/5 overflow-hidden">
          <div
            style={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-[#D4AF37] via-[#F5D058] to-[#D4AF37] transition-[width] duration-75 ease-linear"
          />
        </div>
      </div>
    </aside>
  );
};

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [isReservationOpen, setIsReservationOpen] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    content: ReactNode | string;
  }>({
    isOpen: false,
    title: '',
    content: '',
  });

  const [activeToast, setActiveToast] = useState<ActiveToast | null>(null);
  const cart = useCartSafe();

  const showModal = useCallback((title: string, content: string | ReactNode) => {
    setModalState({ isOpen: true, title, content });
  }, []);

  const closeModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const showToast = useCallback((input: ToastInput, options?: Partial<ToastOptions>) => {
    const toast = normalizeToast(input, options);
    setActiveToast(toast);
  }, []);

  const dismissToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  const contextValue = useMemo(() => ({
    showModal,
    closeModal,
    showToast,
    dismissToast,
    isReservationOpen,
    setIsReservationOpen,
  }), [showModal, closeModal, showToast, dismissToast, isReservationOpen]);

  return (
    <UIContext.Provider value={contextValue}>
      {children}

      {/* Refined Luxury Toast Notification */}
      {activeToast && !cart?.isDrawerOpen && (
        <ToastNotification
          toast={activeToast}
          onDismiss={dismissToast}
          cartCount={cart?.cartCount ?? 0}
          onOpenCart={() => cart?.setIsDrawerOpen(true)}
        />
      )}

      {/* Modal */}
      {modalState.isOpen && (
        <>
          <div
            className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-xs animate-fade-in"
            onClick={closeModal}
          />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[150] w-full max-w-md p-space-lg rounded-2xl bg-surface-container-low border border-outline-variant/30 shadow-2xl flex flex-col gap-space-md animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-headline-md text-on-surface font-bold">
                {modalState.title}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="font-body-md text-on-surface-variant leading-relaxed">
              {modalState.content}
            </div>
            <div className="flex justify-end pt-space-sm border-t border-outline-variant/20 mt-space-sm">
              <button
                type="button"
                onClick={closeModal}
                className="px-space-md py-2 rounded-xl bg-primary text-on-primary font-label-md font-semibold hover:shadow-lg transition-all cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </>
      )}
    </UIContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
