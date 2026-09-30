import React, { useState, useEffect } from 'react';
import type { KitchenOrder } from '../../services/kitchenService';

interface KitchenTicketProps {
  order: KitchenOrder;
  onAdvance: (order: KitchenOrder) => void;
  onCancel?: (order: KitchenOrder) => void;
  isMutating?: boolean;
  density?: 'comfortable' | 'compact';
}

export const KitchenTicket: React.FC<KitchenTicketProps> = ({
  order,
  onAdvance,
  onCancel,
  isMutating = false,
  density = 'comfortable',
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    const createdTime = new Date(order.created_at).getTime();
    return Math.max(0, Math.floor((Date.now() - createdTime) / 1000));
  });

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Live timer update without re-fetching backend
  useEffect(() => {
    const createdTime = new Date(order.created_at).getTime();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - createdTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [order.created_at]);

  // Format MM:SS or HH:MM:SS
  const formatElapsed = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m`;
    }
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  // Urgency styling based on elapsed wait time
  const getUrgencyClasses = (totalSecs: number) => {
    if (totalSecs >= 20 * 60) {
      // > 20 min: Very long wait
      return {
        badge: 'bg-red-950/80 text-red-300 border-red-600/50 shadow-[0_0_12px_rgba(239,68,68,0.2)]',
        cardBorder: 'border-red-800/60 shadow-[0_4px_20px_rgba(239,68,68,0.15)]',
        timerDot: 'bg-red-500 animate-ping',
      };
    }
    if (totalSecs >= 10 * 60) {
      // 10 - 20 min: Long wait / Attention
      return {
        badge: 'bg-amber-950/70 text-amber-300 border-amber-500/40',
        cardBorder: 'border-amber-700/50',
        timerDot: 'bg-amber-400',
      };
    }
    // Normal wait (< 10 min)
    return {
      badge: 'bg-[#1e1510] text-[#D4AF37] border-[#D4AF37]/30',
      cardBorder: 'border-[#2d1f16] hover:border-[#D4AF37]/40',
      timerDot: 'bg-[#D4AF37]',
    };
  };

  const urgency = getUrgencyClasses(elapsedSeconds);
  const isDineIn = order.order_type === 'dine_in';
  const tableDisplay = isDineIn ? `TABLE ${order.table_number || '??'}` : 'TAKEAWAY';

  // Action button labeling and style per column
  const getActionConfig = () => {
    if (order.status === 'pending' || order.status === 'confirmed') {
      return {
        label: 'START PREPARING',
        buttonClass:
          'bg-[#D4AF37] hover:bg-[#b89528] active:bg-[#9a7b1e] text-[#120c08] shadow-[0_2px_12px_rgba(212,175,55,0.25)]',
        statusPill: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        statusLabel: 'NEW',
      };
    }
    if (order.status === 'preparing') {
      return {
        label: 'MARK READY',
        buttonClass:
          'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-[0_2px_12px_rgba(16,185,129,0.25)]',
        statusPill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        statusLabel: 'PREPPING',
      };
    }
    if (order.status === 'ready') {
      return {
        label: 'COMPLETE ORDER',
        buttonClass:
          'bg-[#f5efe6] hover:bg-white active:bg-[#ded7cc] text-[#120c08] shadow-[0_2px_12px_rgba(245,239,230,0.2)]',
        statusPill: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        statusLabel: 'READY',
      };
    }
    return {
      label: 'PROCEED',
      buttonClass: 'bg-neutral-800 text-neutral-300',
      statusPill: 'bg-neutral-800 text-neutral-400',
      statusLabel: order.status.toUpperCase(),
    };
  };

  const action = getActionConfig();

  return (
    <div
      className={`relative bg-[#170f0b] rounded-xl border transition-all duration-200 flex flex-col justify-between ${
        urgency.cardBorder
      } ${density === 'compact' ? 'p-3 mb-2.5' : 'p-4 mb-3.5'}`}
      data-testid={`kitchen-ticket-${order.order_ref}`}
    >
      {/* TICKET TOP HEADER */}
      <div className="flex items-start justify-between gap-2 border-b border-[#2d1f16] pb-2.5">
        <div>
          {/* Order Ref */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold text-[#f5efe6] tracking-tight">
              #{order.order_ref}
            </span>
            <span
              className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                order.source === 'qr'
                  ? 'bg-purple-950/60 text-purple-300 border-purple-800/40'
                  : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/50'
              }`}
            >
              {order.source}
            </span>
          </div>

          {/* Dining Type / Table */}
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`text-xs font-bold tracking-wider px-2 py-0.5 rounded ${
                isDineIn
                  ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40'
                  : 'bg-sky-950/60 text-sky-300 border border-sky-700/40'
              }`}
            >
              {tableDisplay}
            </span>
            {order.customer_name && (
              <span className="text-[11px] text-zinc-400 truncate max-w-[130px]">
                {order.customer_name}
              </span>
            )}
          </div>
        </div>

        {/* Live Elapsed Wait Timer */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-xs font-bold ${urgency.badge}`}
          title="Elapsed wait time since order submission"
        >
          <span className={`w-2 h-2 rounded-full ${urgency.timerDot}`} />
          <span>{formatElapsed(elapsedSeconds)}</span>
        </div>
      </div>

      {/* ITEMS LIST */}
      <div className={`space-y-2 py-3 flex-1 ${density === 'compact' ? 'py-2 space-y-1.5' : 'py-3'}`}>
        {order.items && order.items.length > 0 ? (
          order.items.map((item, idx) => (
            <div
              key={item.id || idx}
              className="flex items-start justify-between text-sm leading-snug group"
            >
              <div className="flex items-start gap-2.5 pr-2">
                <span className="font-mono font-black text-[#D4AF37] text-base min-w-[24px]">
                  {item.quantity}×
                </span>
                <span className="font-semibold text-[#f5efe6] text-sm group-hover:text-white transition-colors">
                  {item.item_name}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-xs text-zinc-500 italic py-1">No item details recorded</div>
        )}
      </div>

      {/* SPECIAL REQUESTS / CHEF NOTE */}
      {order.special_requests && order.special_requests.trim() && (
        <div className="mb-3 p-2.5 rounded-lg bg-amber-950/40 border border-amber-600/30 text-amber-200">
          <div className="flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-amber-400">
            <span>⚡ Special Request</span>
          </div>
          <p className="text-xs mt-0.5 font-medium leading-relaxed">
            "{order.special_requests.trim()}"
          </p>
        </div>
      )}

      {/* ACTION FOOTER */}
      <div className="pt-2 border-t border-[#2d1f16] flex items-center gap-2">
        <button
          type="button"
          disabled={isMutating}
          onClick={() => onAdvance(order)}
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-xs tracking-wider uppercase transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            action.buttonClass
          }`}
          aria-label={`${action.label} for order ${order.order_ref}`}
        >
          {isMutating ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span>Updating...</span>
            </>
          ) : (
            <span>{action.label}</span>
          )}
        </button>

        {/* Cancellation Option */}
        {onCancel && (
          <div className="relative">
            {showCancelConfirm ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelConfirm(false);
                    onCancel(order);
                  }}
                  className="px-2.5 py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold uppercase transition-colors"
                  title="Confirm order cancellation"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="px-2 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold"
                  title="Keep order"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="p-3 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                title="Cancel order"
                aria-label={`Cancel order ${order.order_ref}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
