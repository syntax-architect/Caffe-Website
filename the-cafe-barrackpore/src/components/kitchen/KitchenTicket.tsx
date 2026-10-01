import React, { useState, useEffect } from 'react';
import type { KitchenOrder } from '../../services/kitchenService';
import { playTicketBumpSound, playDispatchChime } from '../../services/soundService';

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
        badge: 'bg-red-950 text-red-200 border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.3)]',
        cardBorder: 'border-red-500/70 shadow-[0_0_25px_rgba(239,68,68,0.2)]',
        timerDot: 'bg-red-400 animate-ping',
      };
    }
    if (totalSecs >= 10 * 60) {
      // 10 - 20 min: Long wait / Attention
      return {
        badge: 'bg-amber-950 text-amber-200 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
        cardBorder: 'border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]',
        timerDot: 'bg-amber-400',
      };
    }
    // Normal wait (< 10 min)
    return {
      badge: 'bg-[#1C1610] text-[#F3C766] border-[#D4AF37]/35',
      cardBorder: 'border-white/[0.08] hover:border-[#D4AF37]/50',
      timerDot: 'bg-[#D4AF37]',
    };
  };

  const urgency = getUrgencyClasses(elapsedSeconds);
  const isDineIn = order.order_type === 'dine_in';
  const tableDisplay = isDineIn ? `TABLE ${order.table_number || '??'}` : 'TAKEAWAY COUNTER';

  // Action button labeling and style per column
  const getActionConfig = () => {
    if (order.status === 'pending' || order.status === 'confirmed') {
      return {
        label: 'START PREPARATION',
        icon: 'soup_kitchen',
        buttonClass:
          'bg-gradient-to-r from-[#D4AF37] to-[#F3C766] hover:from-[#c29f2f] hover:to-[#e4b955] text-[#120B08] shadow-[0_4px_16px_rgba(212,175,55,0.3)]',
      };
    }
    if (order.status === 'preparing') {
      return {
        label: 'MARK DISH READY',
        icon: 'check_circle',
        buttonClass:
          'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-[0_4px_16px_rgba(16,185,129,0.3)]',
      };
    }
    if (order.status === 'ready') {
      return {
        label: 'COMPLETE & DISPATCH',
        icon: 'task_alt',
        buttonClass:
          'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-[0_4px_16px_rgba(59,130,246,0.3)]',
      };
    }
    return {
      label: 'PROCEED',
      icon: 'arrow_forward',
      buttonClass: 'bg-neutral-800 text-neutral-300',
    };
  };

  const action = getActionConfig();

  return (
    <div
      className={`group relative rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-1 border transition-all duration-300 shadow-xl ${
        urgency.cardBorder
      } ${density === 'compact' ? 'mb-2.5' : 'mb-3.5'}`}
      data-testid={`kitchen-ticket-${order.order_ref}`}
    >
      {/* Inner Ticket Card */}
      <div className="rounded-[calc(1rem-0.125rem)] bg-[#130F0D] border border-white/[0.04] p-4 flex flex-col justify-between h-full">
        {/* TICKET TOP HEADER */}
        <div className="border-b border-white/[0.08] pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              {/* Order Reference */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-base sm:text-lg font-bold text-white tracking-wide">
                  #{order.order_ref}
                </span>
                <span
                  className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                    order.source === 'qr'
                      ? 'bg-[#D4AF37]/20 text-[#F3C766] border-[#D4AF37]/35'
                      : 'bg-white/[0.06] text-stone-300 border-white/[0.1]'
                  }`}
                >
                  {order.source || 'website'}
                </span>
                {order.payment_status === 'paid' ? (
                  <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border bg-emerald-950/80 text-emerald-300 border-emerald-600/40">
                    PAID
                  </span>
                ) : (
                  <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border bg-amber-950/80 text-amber-300 border-amber-600/40">
                    COUNTER
                  </span>
                )}
              </div>

              {/* Dining Location & Customer Name */}
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`text-xs font-bold tracking-wider uppercase px-2.5 py-1 rounded-lg ${
                    isDineIn
                      ? 'bg-[#D4AF37]/20 text-[#F3C766] border border-[#D4AF37]/40'
                      : 'bg-sky-950/80 text-sky-300 border border-sky-600/40'
                  }`}
                >
                  {tableDisplay}
                </span>
                {order.customer_name && (
                  <span className="text-xs text-stone-400 font-medium truncate max-w-[140px]">
                    {order.customer_name}
                  </span>
                )}
              </div>
            </div>

            {/* Live Elapsed Wait Timer Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border font-mono text-xs font-bold shadow-sm ${urgency.badge}`}
              title="Elapsed prep time"
            >
              <span className={`w-2 h-2 rounded-full ${urgency.timerDot}`} />
              <span>{formatElapsed(elapsedSeconds)}</span>
            </div>
          </div>
        </div>

        {/* ITEMS LIST (High Visibility for Line Cooks) */}
        <div className={`space-y-2 py-3 flex-1 ${density === 'compact' ? 'py-2 space-y-1.5' : 'py-3.5'}`}>
          {order.items && order.items.length > 0 ? (
            order.items.map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex items-start justify-between text-sm leading-snug group/item"
              >
                <div className="flex items-start gap-2.5 pr-2">
                  <span className="font-mono font-black text-[#F3C766] text-base min-w-[28px] shrink-0">
                    {item.quantity}×
                  </span>
                  <span className="font-bold text-white text-sm group-hover/item:text-[#F3C766] transition-colors">
                    {item.item_name}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-stone-500 italic py-2">No item details recorded</div>
          )}
        </div>

        {/* SPECIAL CHEF INSTRUCTIONS */}
        {order.special_requests && order.special_requests.trim() && (
          <div className="mb-3 p-3 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 shadow-inner">
            <div className="flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-amber-300 mb-0.5">
              <span className="material-symbols-outlined text-xs">priority_high</span>
              <span>Chef Note</span>
            </div>
            <p className="text-xs font-semibold leading-relaxed">
              "{order.special_requests.trim()}"
            </p>
          </div>
        )}

        {/* ACTION PUNCH FOOTER */}
        <div className="pt-3 border-t border-white/[0.08] flex items-center gap-2">
          <button
            type="button"
            disabled={isMutating}
            onClick={() => {
              if (order.status === 'ready') {
                playDispatchChime();
              } else {
                playTicketBumpSound();
              }
              onAdvance(order);
            }}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${
              action.buttonClass
            }`}
            aria-label={`${action.label} for order ${order.order_ref}`}
          >
            {isMutating ? (
              <>
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Updating Ticket...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">{action.icon}</span>
                <span>{action.label}</span>
              </>
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
                    className="px-3 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold uppercase transition-colors shadow"
                    title="Confirm order cancellation"
                  >
                    Void
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(false)}
                    className="px-2.5 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-bold"
                    title="Keep order"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  className="p-3 rounded-xl bg-white/[0.03] hover:bg-red-950/40 text-stone-500 hover:text-red-400 border border-white/[0.06] hover:border-red-500/30 transition-colors cursor-pointer"
                  title="Void order"
                  aria-label={`Void order ${order.order_ref}`}
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KitchenTicket;
