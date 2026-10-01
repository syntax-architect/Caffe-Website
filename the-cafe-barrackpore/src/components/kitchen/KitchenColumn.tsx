import React from 'react';
import type { KitchenOrder } from '../../services/kitchenService';
import { KitchenTicket } from './KitchenTicket';

interface KitchenColumnProps {
  id: 'new' | 'preparing' | 'ready';
  title: string;
  count: number;
  subtitle: string;
  orders: KitchenOrder[];
  onAdvance: (order: KitchenOrder) => void;
  onCancel?: (order: KitchenOrder) => void;
  isMutatingId?: string | null;
  density?: 'comfortable' | 'compact';
}

export const KitchenColumn: React.FC<KitchenColumnProps> = ({
  id,
  title,
  count,
  subtitle,
  orders,
  onAdvance,
  onCancel,
  isMutatingId,
  density = 'comfortable',
}) => {
  // Column color theme
  const getHeaderTheme = () => {
    switch (id) {
      case 'new':
        return {
          pill: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
          dot: 'bg-amber-400',
          accentBorder: 'border-t-amber-500',
          topLine: 'from-amber-500 via-amber-400 to-transparent',
          emptyText: 'No incoming tickets pending',
          emptySub: 'New orders from Dining Tables and Takeaway will stream here in real time.',
        };
      case 'preparing':
        return {
          pill: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35',
          dot: 'bg-indigo-400',
          accentBorder: 'border-t-indigo-500',
          topLine: 'from-indigo-500 via-indigo-400 to-transparent',
          emptyText: 'No dishes currently on the stove',
          emptySub: 'Tap "START PREPARATION" on incoming tickets to transfer them to cook line.',
        };
      case 'ready':
        return {
          pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
          dot: 'bg-emerald-400',
          accentBorder: 'border-t-emerald-500',
          topLine: 'from-emerald-500 via-emerald-400 to-transparent',
          emptyText: 'Pass is clear — no dishes waiting',
          emptySub: 'Completed kitchen dishes appear here awaiting server pickup or takeaway dispatch.',
        };
    }
  };

  const theme = getHeaderTheme();

  return (
    <div
      className="flex flex-col h-full rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-1 border border-white/[0.07] shadow-2xl overflow-hidden"
      data-testid={`kds-column-${id}`}
    >
      {/* Inner Column Enclosure */}
      <div className="flex flex-col h-full rounded-[calc(1rem-0.125rem)] bg-[#0C0A09] border border-white/[0.03] overflow-hidden">
        {/* COLUMN TOP ACCENT LINE */}
        <div className={`h-1 w-full bg-gradient-to-r ${theme.topLine}`} />

        {/* COLUMN STICKY HEADER */}
        <div className="p-4 border-b border-white/[0.08] bg-[#120F0D]/95 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${theme.dot} shadow-sm animate-pulse`} />
            <div>
              <h2 className="text-sm font-black tracking-[0.14em] uppercase text-white font-mono">
                {title}
              </h2>
              <p className="text-[11px] text-stone-400 hidden sm:block mt-0.5">{subtitle}</p>
            </div>
          </div>

          {/* Count Badge */}
          <span
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold border shadow-sm ${theme.pill}`}
            aria-label={`${count} orders in ${title}`}
          >
            {count} {count === 1 ? 'ticket' : 'tickets'}
          </span>
        </div>

        {/* INDEPENDENT COLUMN SCROLL CONTAINER */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-3.5 focus:outline-none custom-scrollbar"
          tabIndex={0}
          aria-label={`${title} orders scroll list`}
        >
          {orders.length > 0 ? (
            orders.map((order) => (
              <KitchenTicket
                key={order.id}
                order={order}
                onAdvance={onAdvance}
                onCancel={onCancel}
                isMutating={isMutatingId === order.id}
                density={density}
              />
            ))
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/[0.08] rounded-2xl bg-white/[0.01] my-4">
              <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-stone-500 mb-3">
                <span className="material-symbols-outlined text-lg">check</span>
              </div>
              <p className="text-xs font-bold text-stone-300">{theme.emptyText}</p>
              <p className="text-[11px] text-stone-500 max-w-[220px] mt-1.5 leading-relaxed">
                {theme.emptySub}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KitchenColumn;
