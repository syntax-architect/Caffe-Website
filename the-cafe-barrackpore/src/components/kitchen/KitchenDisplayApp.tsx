import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useKitchenOrders } from '../../hooks/useKitchenOrders';
import { KitchenTopBar } from './KitchenTopBar';
import { KitchenColumn } from './KitchenColumn';
import { KitchenHistoryDrawer } from './KitchenHistoryDrawer';
import { KitchenEmptyState } from './KitchenEmptyState';
import { createOrder } from '../../services/orderService';
import { unlockAudioContext, playKitchenOrderBell } from '../../services/soundService';

interface KitchenDisplayAppProps {
  onExit?: () => void;
}

export const KitchenDisplayApp: React.FC<KitchenDisplayAppProps> = ({ onExit }) => {
  const { user, staffProfile, role } = useAuth();
  const {
    newOrders,
    preparingOrders,
    readyOrders,
    completedOrders,
    counts,
    isLoading,
    error,
    actionError,
    clearActionError,
    connectionStatus,
    soundEnabled,
    toggleSound,
    density,
    setDensity,
    filter,
    setFilter,
    advanceOrder,
    recallOrder,
    cancelOrder,
    isMutatingId,
    newOrderAlert,
    dismissAlert,
    refreshOrders,
  } = useKitchenOrders();

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const handleExitToDashboard = () => {
    if (onExit) {
      onExit();
    } else if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/staff/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleSimulateTestOrder = async () => {
    await unlockAudioContext();
    const testOrder = {
      customer_name: 'Priya Mukherjee (Table 07)',
      customer_phone: '9830111222',
      order_type: 'dine_in' as const,
      table_number: '07',
      items: [
        {
          id: 'pizza-woodfired-1',
          name: 'Wood-Fired Truffle Margherita Pizza',
          price: 495,
          quantity: 1,
        },
        {
          id: 'beverage-coldbrew-1',
          name: 'Signature Vanilla Bean Cold Brew',
          price: 240,
          quantity: 2,
        },
      ],
      special_requests: 'Extra crispy crust, serve drinks together',
      payment_method: 'pay_at_counter' as const,
    };
    const res = await createOrder(testOrder);
    if (res.success) {
      playKitchenOrderBell();
    }
  };

  const staffDisplayName =
    staffProfile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Staff';

  return (
    <div className="min-h-screen bg-[#0d0805] text-[#f5efe6] flex flex-col font-sans select-none overflow-hidden h-screen">
      {/* TOP BAR */}
      <KitchenTopBar
        connectionStatus={connectionStatus}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        density={density}
        onSetDensity={setDensity}
        filter={filter}
        onSetFilter={setFilter}
        totalActive={counts.totalActive}
        completedCount={counts.completed}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onExitToDashboard={handleExitToDashboard}
        staffName={staffDisplayName}
        staffRole={role || 'staff'}
        onRefresh={refreshOrders}
        onSimulateTestOrder={handleSimulateTestOrder}
      />

      {/* NEW ORDER NOTIFICATION BANNER */}
      {newOrderAlert && (
        <div
          role="alert"
          className="bg-[#D4AF37] text-[#120c08] px-4 py-2 flex items-center justify-between text-xs font-bold tracking-wider uppercase shadow-[0_0_24px_rgba(212,175,55,0.45)] animate-pulse"
        >
          <div className="flex items-center gap-2">
            <span>⚡ NEW ORDER RECEIVED:</span>
            <span className="font-mono text-sm underline">#{newOrderAlert.ref}</span>
            {newOrderAlert.table && (
              <span className="bg-[#120c08] text-[#D4AF37] px-2 py-0.5 rounded font-mono">
                TABLE {newOrderAlert.table}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={dismissAlert}
            className="px-2 py-0.5 rounded bg-[#120c08]/20 hover:bg-[#120c08]/40 transition-colors cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* CONCURRENCY / ACTION ERROR BANNER */}
      {actionError && (
        <div
          role="alert"
          className="bg-amber-950 border-b border-amber-600/40 text-amber-200 px-4 py-2 flex items-center justify-between text-xs"
        >
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold">⚠️ Warning:</span>
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={clearActionError}
            className="px-2 py-0.5 rounded text-amber-300 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* MAIN KDS BOARD */}
      <main className="flex-1 p-3 sm:p-4 overflow-hidden flex flex-col">
        {isLoading ? (
          /* SKELETON TICKETS LOADING STATE */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full animate-pulse">
            {[1, 2, 3].map((col) => (
              <div key={col} className="bg-[#140d08] rounded-xl border border-[#261a13] p-4 flex flex-col gap-4">
                <div className="h-6 bg-[#261a13] rounded w-1/2 mb-2" />
                <div className="h-32 bg-[#1a120c] rounded-xl border border-[#261a13]" />
                <div className="h-32 bg-[#1a120c] rounded-xl border border-[#261a13]" />
              </div>
            ))}
          </div>
        ) : error ? (
          /* ERROR STATE */
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 rounded-full bg-red-950/80 text-red-400 flex items-center justify-center text-xl mb-3">
              ✕
            </div>
            <h2 className="text-base font-bold text-red-300">{error}</h2>
            <button
              type="button"
              onClick={refreshOrders}
              className="mt-4 px-4 py-2 rounded-lg bg-[#D4AF37] text-[#120c08] text-xs font-bold uppercase tracking-wider hover:bg-[#b89528] cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        ) : counts.totalActive === 0 ? (
          /* EMPTY STATE */
          <KitchenEmptyState
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
            onRefresh={refreshOrders}
          />
        ) : (
          /* 3 OPERATIONAL COLUMNS */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 h-full min-h-0">
            {/* Column 1: NEW */}
            <KitchenColumn
              id="new"
              title="New Orders"
              subtitle="Pending preparation"
              count={counts.new}
              orders={newOrders}
              onAdvance={advanceOrder}
              onCancel={cancelOrder}
              isMutatingId={isMutatingId}
              density={density}
            />

            {/* Column 2: PREPARING */}
            <KitchenColumn
              id="preparing"
              title="Preparing"
              subtitle="On the stove / grill / bar"
              count={counts.preparing}
              orders={preparingOrders}
              onAdvance={advanceOrder}
              onCancel={cancelOrder}
              isMutatingId={isMutatingId}
              density={density}
            />

            {/* Column 3: READY */}
            <KitchenColumn
              id="ready"
              title="Ready for Pickup"
              subtitle="Awaiting table service or customer pickup"
              count={counts.ready}
              orders={readyOrders}
              onAdvance={advanceOrder}
              onCancel={cancelOrder}
              isMutatingId={isMutatingId}
              density={density}
            />
          </div>
        )}
      </main>

      {/* COMPLETED ORDERS HISTORY DRAWER */}
      <KitchenHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        completedOrders={completedOrders}
        onRecall={recallOrder}
        isMutatingId={isMutatingId}
      />
    </div>
  );
};

export default KitchenDisplayApp;
