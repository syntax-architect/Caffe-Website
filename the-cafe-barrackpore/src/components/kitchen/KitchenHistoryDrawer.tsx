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
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-drawer-title"
    >
      {/* Backdrop click to close */}
      <div className="flex-1" onClick={onClose} aria-hidden="true" />

      {/* Drawer Container */}
      <div className="w-full max-w-md bg-[#140d08] border-l border-[#261a13] h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#261a13] flex items-center justify-between bg-[#19100a]">
          <div>
            <h2 id="history-drawer-title" className="text-base font-bold text-[#f5efe6] font-serif">
              Recent Completed Orders
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Showing last {completedOrders.length} finished tickets
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Close completed orders drawer"
          >
            ✕
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
                  className="p-3.5 rounded-xl bg-[#1a120c] border border-[#2d1f16] flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-[#f5efe6]">
                          #{order.order_ref}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 uppercase">
                          {order.source}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[#D4AF37] px-2 py-0.5 rounded bg-[#D4AF37]/10 border border-[#D4AF37]/30">
                          {tableText}
                        </span>
                        {order.customer_name && (
                          <span className="text-xs text-zinc-400 truncate max-w-[120px]">
                            {order.customer_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {formatCompletionTime(order.updated_at || order.created_at)}
                      </span>
                      <div className="mt-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-700/40">
                          ✓ Completed
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Items summary */}
                  <div className="py-1 border-t border-[#261a13] text-xs space-y-1">
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
                  <div className="pt-2 border-t border-[#261a13] flex justify-end">
                    <button
                      type="button"
                      disabled={isMutatingId === order.id}
                      onClick={() => onRecall(order)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-amber-300 bg-amber-950/50 hover:bg-amber-900/60 border border-amber-600/40 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Recall this order back into the Ready column"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                        />
                      </svg>
                      <span>Recall to Ready</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
              <span className="text-2xl mb-2">📜</span>
              <p className="text-xs font-semibold">No recently completed orders</p>
              <p className="text-[11px] text-zinc-600 mt-1 max-w-[200px]">
                Orders marked as completed will be recorded here for fast reference.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
