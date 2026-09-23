import { createContext, useContext, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface UIContextType {
  showModal: (title: string, content: string | ReactNode) => void;
  closeModal: () => void;
  showToast: (message: string) => void;
  isReservationOpen: boolean;
  setIsReservationOpen: (value: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [isReservationOpen, setIsReservationOpen] = useState(false);
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; content: ReactNode | string }>({
    isOpen: false,
    title: '',
    content: ''
  });
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showModal = (title: string, content: string | ReactNode) => {
    setModalState({ isOpen: true, title, content });
  };

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <UIContext.Provider value={{ showModal, closeModal, showToast, isReservationOpen, setIsReservationOpen }}>
      {children}
      
      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-24 left-1/2 z-[100] pointer-events-none"
          >
            <div className="flex items-center gap-2 px-6 py-3 rounded-full bg-surface-container-highest/90 border border-primary/30 shadow-[0_4px_24px_rgba(0,0,0,0.4)] text-on-surface font-label-md">
              <span className="material-symbols-outlined text-primary text-lg">info</span>
              <span>{toastMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {modalState.isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] bg-black/60"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: '-45%', x: '-50%' }}
              animate={{ opacity: 1, scale: 1, y: '-50%', x: '-50%' }}
              exit={{ opacity: 0, scale: 0.95, y: '-45%', x: '-50%' }}
              className="fixed top-1/2 left-1/2 z-[120] w-full max-w-md p-space-lg rounded-2xl bg-surface-container-low border border-outline-variant/30 shadow-2xl flex flex-col gap-space-md"
              style={{ x: '-50%', y: '-50%' }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-headline-md text-on-surface font-bold">{modalState.title}</h3>
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
              <div className="font-body-md text-on-surface-variant leading-relaxed">
                {modalState.content}
              </div>
              <div className="flex justify-end pt-space-sm border-t border-outline-variant/20 mt-space-sm">
                <button onClick={closeModal} className="px-space-md py-2 rounded-xl bg-primary text-on-primary font-label-md font-semibold hover:shadow-lg transition-all">
                  Got it
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
