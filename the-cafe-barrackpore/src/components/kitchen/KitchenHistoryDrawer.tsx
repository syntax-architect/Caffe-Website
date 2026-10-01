import React from 'react';
import type { KitchenOrder } from '../../services/kitchenService';

interface KitchenHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  completedOrders: KitchenOrder[];
  onRecall: (order: KitchenOrder) => void;
  isMutatingId?: string | null;
}

export const KitchenHistoryDrawer: React.FC<KitchenHistoryDrawerProps> = ({
  isOpen,
  onClose,
  completedOrders,
  onRecall,
  isMutatingId,
}) => {
  if (!isOpen) return null;

  const formatCompletionTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-md transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-drawer-title"
    >
      {/* Backdrop click to close */}
      <div className="flex-1" onClick={onClose} aria-hidden="true" />

      {/* Drawer Container */}
      <div className="w-full max-w-md bg-[#0F0B09] border-l border-white/[0.1] h-full flex flex-col shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between bg-[#120F0D]">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
              Dispatch Archives
            </span>
            <h2 id="history-drawer-title" className="text-lg font-serif font-black text-white mt-0.5">
              Completed Kitchen Tickets
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Showing last {completedOrders.length} fulfilled orders
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-xl border border-white/[0.06] transition-colors cursor-pointer"
            aria-label="Close completed orders drawer"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {completedOrders.length > 0 ? (
            completedOrders.map((order) => {
              const isDineIn = order.order_type === 'dine_in';
              const tableText = isDineIn ? `TABLE ${order.table_number || '??'}` : 'TAKEAWAY';

              return (
                <div
                  key={order.id}
                  className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.08]"
                >
                  <div className="p-4 rounded-[calc(1rem-0.125rem)] bg-[#120F0D] flex flex-col gap-2.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-white">
                            #{order.order_ref}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-400 uppercase">
                            {order.source}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-[#D4AF37] px-2 py-0.5 rounded bg-[#D4AF37]/10 border border-[#D4AF37]/30">
                            {tableText}
                          </span>
                          {order.customer_name && (
                            <span className="text-xs text-zinc-400 truncate max-w-[130px]">
                              {order.customer_name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {formatCompletionTime(order.updated_at || order.created_at)}
                        </span>
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Fulfilled
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Items summary */}
                    <div className="py-2 border-t border-white/[0.06] text-xs space-y-1.5">
                      {order.items?.map((it, idx) => (
                        <div key={it.id || idx} className="flex items-center gap-2 text-zinc-300">
                          <span className="font-mono font-bold text-[#D4AF37] text-xs">
                            {it.quantity}×
                          </span>
                          <span className="text-xs">{it.item_name}</span>
                        </div>
                      ))}
                    </div>

                    {/* Recall Action */}
                    <div className="pt-2 border-t border-white/[0.06] flex justify-end">
                      <button
                        type="button"
                        disabled={isMutatingId === order.id}
                        onClick={() => onRecall(order)}
                        className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-600/40 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        title="Recall this ticket back into the Ready column"
                      >
                        <span className="material-symbols-outlined text-sm">history</span>
                        <span>Recall to Ready</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
              <span className="material-symbols-outlined text-4xl mb-2 text-zinc-600">receipt_long</span>
              <p className="font-serif font-bold text-sm text-white">No recently completed tickets</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-[220px]">
                Orders punched as completed will archive here for quick kitchen recall.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KitchenHistoryDrawer;
