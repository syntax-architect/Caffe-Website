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
          pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          dot: 'bg-amber-400',
          border: 'border-t-amber-500',
          emptyText: 'No incoming orders waiting',
          emptySub: 'New orders from tables and takeaway will appear here automatically',
        };
      case 'preparing':
        return {
          pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-400',
          border: 'border-t-emerald-500',
          emptyText: 'No dishes currently in prep',
          emptySub: 'Tap "Start Preparing" on any incoming order to move it here',
        };
      case 'ready':
        return {
          pill: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
          dot: 'bg-blue-400',
          border: 'border-t-blue-500',
          emptyText: 'No dishes waiting for service',
          emptySub: 'Orders marked ready will wait here until collected or served',
        };
    }
  };

  const theme = getHeaderTheme();

  return (
    <div
      className={`flex flex-col h-full bg-[#120c08] rounded-xl border border-[#261a13] border-t-4 ${theme.border} overflow-hidden shadow-lg`}
      data-testid={`kds-column-${id}`}
    >
      {/* COLUMN STICKY HEADER */}
      <div className="p-3.5 border-b border-[#261a13] bg-[#170f0b]/90 backdrop-blur-sm flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${theme.dot}`} />
          <div>
            <h2 className="text-sm font-black tracking-wider uppercase text-[#f5efe6]">
              {title}
            </h2>
            <p className="text-[11px] text-zinc-400 hidden sm:block">{subtitle}</p>
          </div>
        </div>

        {/* Count Badge */}
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${theme.pill}`}
          aria-label={`${count} orders in ${title}`}
        >
          {count} {count === 1 ? 'ticket' : 'tickets'}
        </span>
      </div>

      {/* INDEPENDENT COLUMN SCROLL CONTAINER */}
      <div
        className="flex-1 overflow-y-auto p-3.5 space-y-3 focus:outline-none"
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
          <div className="h-48 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#261a13] rounded-xl bg-[#140d09]/40 my-4">
            <span className="w-8 h-8 rounded-full bg-[#1e1510] flex items-center justify-center text-zinc-600 mb-2">
              ✓
            </span>
            <p className="text-xs font-semibold text-zinc-400">{theme.emptyText}</p>
            <p className="text-[11px] text-zinc-600 max-w-[200px] mt-1 leading-relaxed">
              {theme.emptySub}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
