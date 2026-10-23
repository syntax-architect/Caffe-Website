import { useI18n } from '../../i18n';
import React, { useState, useEffect, useCallback } from 'react';
import type { CashShift, CashDrawerTransaction, ZReportData } from '../../types/billing';
import {
  getCurrentShift,
  openShift,
  recordCashTransaction,
  closeShift,
  generateZReport,
  getShiftTransactions,
  getShiftHistory,
} from '../../services/cashDrawerService';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { formatCurrency } from '../../utils/currency';
import { printZReport } from '../../utils/printReceipt';
import { formatRestaurantDateTime } from '../../utils/datetime';
import { useSiteConfig } from '../../context/SiteConfigContext';

export const CashDrawerManagement: React.FC = () => {
  const { t } = useI18n(); void t;
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const { restaurantConfig } = useSiteConfig();
  const currency = restaurantConfig.currency || 'INR';
  const currencySymbol = restaurantConfig.currencySymbol || '₹';

  const [currentShift, setCurrentShift] = useState<CashShift | null>(null);
  const [shiftTxs, setShiftTxs] = useState<CashDrawerTransaction[]>([]);
  const [liveZReport, setLiveZReport] = useState<ZReportData | null>(null);
  const [pastShifts, setPastShifts] = useState<CashShift[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Modals
  const [showOpenModal, setShowOpenModal] = useState<boolean>(false);
  const [openingFloatInput, setOpeningFloatInput] = useState<number>(2000);

  const [showTxModal, setShowTxModal] = useState<boolean>(false);
  const [txType, setTxType] = useState<'cash_in' | 'cash_out'>('cash_in');
  const [txAmount, setTxAmount] = useState<number>(500);
  const [txReason, setTxReason] = useState<string>('');

  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [countedCashInput, setCountedCashInput] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState<string>('');

  const [selectedZReport, setSelectedZReport] = useState<ZReportData | null>(null);

  const loadShiftData = useCallback(async () => {
    try {
      const shift = await getCurrentShift();
      setCurrentShift(shift);

      if (shift) {
        const [txs, zReport] = await Promise.all([
          getShiftTransactions(shift.id),
          generateZReport(shift.id),
        ]);
        setShiftTxs(txs);
        setLiveZReport(zReport);
        setCountedCashInput(zReport.expectedCashInDrawer);
      } else {
        setShiftTxs([]);
        setLiveZReport(null);
      }

      const history = await getShiftHistory(15);
      setPastShifts(history);
    } catch (e: any) {
      console.error('Failed to load shift data:', e);
    }
  }, []);

  useEffect(() => {
    loadShiftData();
  }, [loadShiftData]);

  // Open Shift
  const handleOpenShift = async () => {
    setIsProcessing(true);
    try {
      const res = await openShift({
        openingFloat: openingFloatInput,
        openedById: user?.id || 'cashier',
        openedByName: user?.email || 'Cashier',
      });

      if (res.success && res.shift) {
        addNotification(
          'success',
          'Shift Opened',
          `Shift #${res.shift.shift_number} opened with float of ${formatCurrency(openingFloatInput)}.`
        );
        setShowOpenModal(false);
        await loadShiftData();
      } else {
        addNotification('error', 'Open Failed', res.error || 'Could not open shift.');
      }
    } catch (e: any) {
      addNotification('error', 'Error', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Record Cash In / Out
  const handleRecordTransaction = async () => {
    if (!currentShift) return;
    if (!txReason.trim()) {
      addNotification('error', 'Validation Error', 'A reason is required for cash drawer transactions.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await recordCashTransaction({
        shiftId: currentShift.id,
        type: txType,
        amount: txAmount,
        reason: txReason.trim(),
        actorId: user?.id || 'cashier',
        actorName: user?.email || 'Cashier',
      });

      if (res.success) {
        addNotification(
          'success',
          txType === 'cash_in' ? 'Cash In Recorded' : 'Cash Out Recorded',
          `${formatCurrency(txAmount)} recorded: ${txReason}`
        );
        setShowTxModal(false);
        setTxReason('');
        await loadShiftData();
      } else {
        addNotification('error', 'Transaction Failed', res.error || 'Could not record cash transaction.');
      }
    } catch (e: any) {
      addNotification('error', 'Error', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Close Shift & Produce Z-Report
  const handleCloseShift = async () => {
    if (!currentShift) return;
    setIsProcessing(true);
    try {
      const res = await closeShift({
        shiftId: currentShift.id,
        countedCash: countedCashInput,
        closedById: user?.id || 'cashier',
        closedByName: user?.email || 'Cashier',
        closingNotes: closingNotes.trim() || undefined,
      });

      if (res.success && res.zReport) {
        addNotification(
          'success',
          'Shift Closed',
          `Shift #${currentShift.shift_number} successfully closed. Variance: ${formatCurrency(res.zReport.variance)}.`
        );
        setShowCloseModal(false);
        setSelectedZReport(res.zReport);
        await loadShiftData();
      } else {
        addNotification('error', 'Close Failed', res.error || 'Could not close shift.');
      }
    } catch (e: any) {
      addNotification('error', 'Error', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Print Z-Report
  const handlePrintZReport = (report: ZReportData) => {
    printZReport(report);
    addNotification('info', 'Print Dispatched', 'Z-Report sent to thermal receipt printer.');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner & Quick Controls */}
      <div className="p-1.5 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.07] shadow-lg">
        <div className="rounded-[calc(1rem-0.125rem)] bg-[#120F0D]/95 border border-white/[0.04] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] material-symbols-outlined text-2xl">
              point_of_sale
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-lg font-bold text-white">{t('staff.pos.cash_drawer_shift_management', 'Cash Drawer & Shift Management')}</h2>
                {currentShift ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Shift #{currentShift.shift_number} Active
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-stone-500/20 text-stone-400 border border-stone-500/30">
                    No Active Shift
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400 mt-0.5 flex items-center gap-2">
                <span>{t('staff.pos.opening_floats_cash_in_out_rea', 'Opening floats, cash in/out reason logs, physical cash count balancing, and Z-report audits')}</span>
                {isProcessing && <span className="text-[10px] text-amber-400 font-mono animate-pulse">{t('staff.pos.syncing', 'Syncing...')}</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!currentShift ? (
              <button
                type="button"
                onClick={() => setShowOpenModal(true)}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] hover:from-[#c29f2f] hover:to-[#e0b555] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">lock_open</span>
                Open New Shift
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowTxModal(true)}
                  className="py-2 px-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-stone-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">currency_exchange</span>
                  Cash In / Out
                </button>
                <button
                  type="button"
                  onClick={() => liveZReport && setSelectedZReport(liveZReport)}
                  className="py-2 px-3.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">summarize</span>
                  Live Z-Report
                </button>
                <button
                  type="button"
                  onClick={() => setShowCloseModal(true)}
                  className="py-2 px-3.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">lock</span>
                  Close Shift
                </button>
              </>
            )}
            <button
              type="button"
              onClick={loadShiftData}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-stone-300 hover:text-white border border-white/[0.08] transition-colors"
              title="Refresh"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Shift Real-Time Monitor */}
      {currentShift && liveZReport ? (
        <div className="space-y-6">
          {/* KPI Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 block mb-1">
                Opening Float
              </span>
              <div className="text-lg font-mono font-bold text-white">
                {formatCurrency(liveZReport.openingFloat)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 block mb-1">
                Cash Sales
              </span>
              <div className="text-lg font-mono font-bold text-emerald-300">
                {formatCurrency(liveZReport.cashSales)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 block mb-1">
                Cash In (Paid In)
              </span>
              <div className="text-lg font-mono font-bold text-blue-300">
                +{formatCurrency(liveZReport.cashInTotal)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 block mb-1">
                Cash Out (Paid Out)
              </span>
              <div className="text-lg font-mono font-bold text-amber-300">
                -{formatCurrency(liveZReport.cashOutTotal)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 block mb-1">
                Card / UPI / Online
              </span>
              <div className="text-lg font-mono font-bold text-purple-300">
                {formatCurrency(
                  liveZReport.tenderBreakdown.card +
                    liveZReport.tenderBreakdown.upi +
                    liveZReport.tenderBreakdown.stripe
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-b from-[#D4AF37]/15 to-transparent border border-[#D4AF37]/30">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#F3C766] font-bold block mb-1">
                Expected in Drawer
              </span>
              <div className="text-xl font-mono font-bold text-[#F3C766]">
                {formatCurrency(liveZReport.expectedCashInDrawer)}
              </div>
            </div>
          </div>

          {/* Shift Transactions Ledger */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-sm font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#D4AF37]">receipt_long</span>
                Current Shift Cash Movement Ledger ({shiftTxs.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowTxModal(true)}
                className="text-xs text-[#F3C766] hover:underline flex items-center gap-1"
              >
                + Record Paid In / Out
              </button>
            </div>

            {shiftTxs.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-500">
                No manual cash in/out transactions recorded in this shift yet.
              </div>
            ) : (
              <div className="space-y-2">
                {shiftTxs.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs uppercase ${
                          tx.type === 'cash_in'
                            ? 'bg-blue-500/20 text-blue-300'
                            : tx.type === 'cash_out'
                            ? 'bg-amber-500/20 text-amber-300'
                            : tx.type === 'refund'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {tx.type === 'cash_in' ? 'IN' : tx.type === 'cash_out' ? 'OUT' : tx.type === 'refund' ? 'REF' : 'SALE'}
                      </span>
                      <div>
                        <div className="font-bold text-white">{tx.reason}</div>
                        <div className="text-[10px] text-stone-500 font-mono">
                          {tx.actor_name} • {formatRestaurantDateTime(new Date(tx.created_at), restaurantConfig.locale, restaurantConfig.timezone)}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`font-mono font-bold text-sm ${
                        tx.type === 'cash_in' || tx.type === 'sale'
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {tx.type === 'cash_in' || tx.type === 'sale' ? '+' : '-'}
                      {formatCurrency(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-stone-500">point_of_sale</span>
          <h3 className="font-serif text-base font-bold text-white">{t('staff.pos.cash_drawer_is_closed', 'Cash Drawer is Closed')}</h3>
          <p className="text-xs text-stone-400 max-w-md mx-auto">
            Opening a shift with an opening float initializes the cash drawer ledger and tracks all cash tenders, change returns, and sales.
          </p>
          <button
            type="button"
            onClick={() => setShowOpenModal(true)}
            className="py-2.5 px-6 rounded-xl bg-[#D4AF37] hover:bg-[#c29f2f] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">lock_open</span>
            Open Shift Now
          </button>
        </div>
      )}

      {/* Historical Shifts Archive */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5">
        <h3 className="font-serif text-sm font-bold text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-[#D4AF37]">history</span>
          Closed Shift Archive & Past Z-Reports
        </h3>

        {pastShifts.filter((s) => s.status === 'closed').length === 0 ? (
          <div className="py-8 text-center text-xs text-stone-500">
            No closed shifts in the archive yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-white/[0.02] text-[10px] font-mono uppercase tracking-wider text-stone-400 border-b border-white/[0.06]">
                <tr>
                  <th className="py-2.5 px-3">{t('staff.pos.shift', 'Shift')}</th>
                  <th className="py-2.5 px-3">{t('staff.pos.opened', 'Opened')}</th>
                  <th className="py-2.5 px-3">{t('staff.pos.closed', 'Closed')}</th>
                  <th className="py-2.5 px-3">{t('staff.pos.cashier', 'Cashier')}</th>
                  <th className="py-2.5 px-3 text-right">{t('staff.pos.float', 'Float')}</th>
                  <th className="py-2.5 px-3 text-right">{t('staff.pos.expected', 'Expected')}</th>
                  <th className="py-2.5 px-3 text-right">{t('staff.pos.counted', 'Counted')}</th>
                  <th className="py-2.5 px-3 text-right">{t('staff.pos.variance', 'Variance')}</th>
                  <th className="py-2.5 px-3 text-center">{t('staff.pos.action', 'Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {pastShifts
                  .filter((s) => s.status === 'closed')
                  .map((s) => (
                    <tr key={s.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-3 font-mono font-bold text-white">#{s.shift_number}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-stone-400">
                        {formatRestaurantDateTime(new Date(s.opened_at), restaurantConfig.locale, restaurantConfig.timezone)}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-stone-400">
                        {s.closed_at
                          ? formatRestaurantDateTime(new Date(s.closed_at), restaurantConfig.locale, restaurantConfig.timezone)
                          : '--'}
                      </td>
                      <td className="py-3 px-3">{s.opened_by_name}</td>
                      <td className="py-3 px-3 font-mono text-right">{formatCurrency(s.opening_float || 0)}</td>
                      <td className="py-3 px-3 font-mono text-right">{formatCurrency(s.expected_cash || 0)}</td>
                      <td className="py-3 px-3 font-mono text-right font-bold text-white">
                        {formatCurrency(s.counted_cash || 0)}
                      </td>
                      <td
                        className={`py-3 px-3 font-mono text-right font-bold ${
                          (s.difference || 0) === 0
                            ? 'text-stone-300'
                            : (s.difference || 0) > 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {(s.difference || 0) >= 0 ? '+' : ''}
                        {formatCurrency(s.difference || 0)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => s.z_report_summary && setSelectedZReport(s.z_report_summary)}
                          className="px-2.5 py-1 rounded bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#F3C766] border border-[#D4AF37]/30 text-[10px] font-mono font-bold uppercase transition-colors"
                        >
                          View Z-Report
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* -------------------- MODAL: OPEN SHIFT -------------------- */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#120F0D] border border-white/[0.1] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="font-serif text-base font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D4AF37]">lock_open</span>
                Open Cash Shift
              </h3>
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="w-7 h-7 rounded-full bg-white/[0.05] text-stone-400 hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div>
              <label className="text-xs text-stone-300 block mb-1 font-semibold">
                Opening Cash Float in Drawer:
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-mono text-sm">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  step="1"
                  value={openingFloatInput}
                  onChange={(e) => setOpeningFloatInput(Number(e.target.value) || 0)}
                  className="w-full bg-[#080706] border border-white/[0.1] focus:border-[#D4AF37] rounded-xl pl-8 pr-3 py-2 text-base text-white font-mono font-bold focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                Enter the verified starting cash in the till (bills + coins).
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-stone-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleOpenShift}
                className="flex-1 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c29f2f] text-black text-xs font-bold uppercase tracking-wider shadow-md"
              >
                {isProcessing ? 'Opening...' : 'Confirm & Open'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: RECORD CASH IN / OUT -------------------- */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#120F0D] border border-white/[0.1] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="font-serif text-base font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D4AF37]">currency_exchange</span>
                Record Cash In / Cash Out
              </h3>
              <button
                type="button"
                onClick={() => setShowTxModal(false)}
                className="w-7 h-7 rounded-full bg-white/[0.05] text-stone-400 hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Type selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTxType('cash_in')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  txType === 'cash_in'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                    : 'bg-white/[0.03] border-white/[0.08] text-stone-400'
                }`}
              >
                <span className="material-symbols-outlined text-sm">arrow_downward</span>
                Cash In (Paid In)
              </button>
              <button
                type="button"
                onClick={() => setTxType('cash_out')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  txType === 'cash_out'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-white/[0.03] border-white/[0.08] text-stone-400'
                }`}
              >
                <span className="material-symbols-outlined text-sm">arrow_upward</span>
                Cash Out (Paid Out)
              </button>
            </div>

            <div>
              <label className="text-xs text-stone-300 block mb-1">{t('staff.pos.amount', 'Amount')}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-mono text-sm">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={txAmount}
                  onChange={(e) => setTxAmount(Number(e.target.value) || 0)}
                  className="w-full bg-[#080706] border border-white/[0.1] rounded-xl pl-8 pr-3 py-2 text-sm text-white font-mono font-bold focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-stone-300 block mb-1">{t('staff.pos.reason_notes', 'Reason / Notes')}</label>
              <input
                type="text"
                placeholder={t('staff.pos.e_g_bank_change_delivery_petty', 'e.g. Bank change delivery, petty cash for lemons, vendor advance')}
                value={txReason}
                onChange={(e) => setTxReason(e.target.value)}
                className="w-full bg-[#080706] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTxModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-stone-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleRecordTransaction}
                className="flex-1 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c29f2f] text-black text-xs font-bold uppercase tracking-wider shadow-md"
              >
                {isProcessing ? 'Saving...' : 'Record Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: CLOSE SHIFT -------------------- */}
      {showCloseModal && currentShift && liveZReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#120F0D] border border-white/[0.1] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="font-serif text-base font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-400">lock</span>
                Close Shift #{currentShift.shift_number} & Z-Report
              </h3>
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="w-7 h-7 rounded-full bg-white/[0.05] text-stone-400 hover:text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-400">{t('staff.pos.opening_float', 'Opening Float:')}</span>
                <span className="font-mono text-white">{formatCurrency(liveZReport.openingFloat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">{t('staff.pos.net_cash_sales_tips', 'Net Cash Sales & Tips:')}</span>
                <span className="font-mono text-white">+{formatCurrency(liveZReport.cashSales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">{t('staff.pos.cash_movements_in_out', 'Cash Movements (In - Out):')}</span>
                <span className="font-mono text-white">
                  {formatCurrency(liveZReport.cashInTotal - liveZReport.cashOutTotal - liveZReport.cashRefunds)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-white/[0.06] font-bold">
                <span className="text-[#F3C766]">{t('staff.pos.expected_cash_in_drawer', 'Expected Cash in Drawer:')}</span>
                <span className="font-mono text-[#F3C766] text-sm">
                  {formatCurrency(liveZReport.expectedCashInDrawer)}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs text-stone-300 block mb-1 font-semibold">
                Counted Physical Cash in Drawer:
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-mono text-sm">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={countedCashInput}
                  onChange={(e) => setCountedCashInput(Number(e.target.value) || 0)}
                  className="w-full bg-[#080706] border border-white/[0.1] focus:border-[#D4AF37] rounded-xl pl-8 pr-3 py-2 text-base text-white font-mono font-bold focus:outline-none"
                />
              </div>
            </div>

            {/* Difference / Variance Live Readout */}
            {(() => {
              const variance = countedCashInput - liveZReport.expectedCashInDrawer;
              return (
                <div
                  className={`p-3 rounded-xl border flex justify-between items-center text-xs font-bold ${
                    variance === 0
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                      : variance > 0
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <span>{t('staff.pos.difference_variance', 'Difference (Variance):')}</span>
                  <span className="font-mono text-sm">
                    {variance === 0
                      ? `${formatCurrency(0, currency)} (EXACT MATCH)`
                      : `${variance > 0 ? '+' : ''}${formatCurrency(variance, currency)} (${
                          variance > 0 ? 'CASH OVER' : 'CASH SHORT'
                        })`}
                  </span>
                </div>
              );
            })()}

            <div>
              <label className="text-xs text-stone-300 block mb-1">{t('staff.pos.closing_notes_optional', 'Closing Notes (Optional)')}</label>
              <textarea
                rows={2}
                placeholder={t('staff.pos.shift_handoff_notes_or_varianc', 'Shift handoff notes or variance explanation...')}
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                className="w-full bg-[#080706] border border-white/[0.1] rounded-xl p-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-stone-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleCloseShift}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase tracking-wider shadow-md"
              >
                {isProcessing ? 'Closing...' : 'Confirm & Close Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: VIEW & PRINT Z-REPORT -------------------- */}
      {selectedZReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#120F0D] border border-white/[0.1] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#D4AF37]">summarize</span>
                <h3 className="font-serif text-base font-bold text-white">
                  Z-Report • Shift #{selectedZReport.shiftNumber}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintZReport(selectedZReport)}
                  className="py-1.5 px-3 rounded-lg bg-[#D4AF37] hover:bg-[#c29f2f] text-black text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  Print Thermal
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedZReport(null)}
                  className="w-7 h-7 rounded-full bg-white/[0.05] text-stone-400 hover:text-white flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-xs text-stone-300">
              {/* Header Box */}
              <div className="text-center pb-3 border-b border-white/[0.08] space-y-1">
                <h4 className="font-serif text-lg font-bold text-white tracking-wider">
                  {selectedZReport.restaurantName}
                </h4>
                <div className="text-[11px] text-[#F3C766] uppercase font-bold">
                  DAILY FINANCIAL Z-REPORT
                </div>
                <div className="text-[10px] text-stone-400">
                  Shift #{selectedZReport.shiftNumber} • Total Txns: {selectedZReport.totalTransactionCount}
                </div>
              </div>

              {/* Shift Timing & Staff */}
              <div className="space-y-1 text-[11px] py-1 border-b border-white/[0.06]">
                <div className="flex justify-between">
                  <span className="text-stone-500">{t('staff.pos.opened', 'Opened:')}</span>
                  <span>{formatRestaurantDateTime(new Date(selectedZReport.openedAt), restaurantConfig.locale, restaurantConfig.timezone)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">{t('staff.pos.closed', 'Closed:')}</span>
                  <span>{formatRestaurantDateTime(new Date(selectedZReport.closedAt), restaurantConfig.locale, restaurantConfig.timezone)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">{t('staff.pos.opened_by', 'Opened By:')}</span>
                  <span>{selectedZReport.openedByName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">{t('staff.pos.closed_by', 'Closed By:')}</span>
                  <span>{selectedZReport.closedByName}</span>
                </div>
              </div>

              {/* Drawer Balancing */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] block mb-2">
                  CASH DRAWER RECONCILIATION
                </span>
                <div className="space-y-1 bg-white/[0.02] p-3 rounded-lg border border-white/[0.06]">
                  <div className="flex justify-between">
                    <span>{t('staff.pos.opening_float', 'Opening Float:')}</span>
                    <span>{formatCurrency(selectedZReport.openingFloat)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('staff.pos.cash_sales', 'Cash Sales:')}</span>
                    <span>+{formatCurrency(selectedZReport.cashSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('staff.pos.cash_in_paid_in', 'Cash In (Paid In):')}</span>
                    <span>+{formatCurrency(selectedZReport.cashInTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('staff.pos.cash_out_paid_out', 'Cash Out (Paid Out):')}</span>
                    <span>-{formatCurrency(selectedZReport.cashOutTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('staff.pos.cash_refunds', 'Cash Refunds:')}</span>
                    <span>-{formatCurrency(selectedZReport.cashRefunds)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/[0.06] font-bold text-white">
                    <span>{t('staff.pos.expected_in_drawer', 'Expected in Drawer:')}</span>
                    <span>{formatCurrency(selectedZReport.expectedCashInDrawer)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-white">
                    <span>{t('staff.pos.counted_in_drawer', 'Counted in Drawer:')}</span>
                    <span>{formatCurrency(selectedZReport.countedCashInDrawer)}</span>
                  </div>
                  <div
                    className={`flex justify-between font-bold ${
                      selectedZReport.variance === 0
                        ? 'text-emerald-400'
                        : selectedZReport.variance > 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    <span>{t('staff.pos.variance', 'Variance:')}</span>
                    <span>
                      {selectedZReport.variance >= 0 ? '+' : ''}
                      {formatCurrency(selectedZReport.variance)}{' '}
                      {selectedZReport.variance === 0
                        ? '(EXACT)'
                        : selectedZReport.variance > 0
                        ? '(OVER)'
                        : '(SHORT)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tenders Breakdown */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] block mb-2">
                  SALES BY TENDER TYPE
                </span>
                <div className="space-y-1 bg-white/[0.02] p-3 rounded-lg border border-white/[0.06]">
                  <div className="flex justify-between">
                    <span>Cash ({selectedZReport.tenderCounts.cash}x):</span>
                    <span>{formatCurrency(selectedZReport.tenderBreakdown.cash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Card ({selectedZReport.tenderCounts.card}x):</span>
                    <span>{formatCurrency(selectedZReport.tenderBreakdown.card)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>UPI ({selectedZReport.tenderCounts.upi}x):</span>
                    <span>{formatCurrency(selectedZReport.tenderBreakdown.upi)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stripe ({selectedZReport.tenderCounts.stripe}x):</span>
                    <span>{formatCurrency(selectedZReport.tenderBreakdown.stripe)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Other ({selectedZReport.tenderCounts.other}x):</span>
                    <span>{formatCurrency(selectedZReport.tenderBreakdown.other)}</span>
                  </div>
                </div>
              </div>

              {/* Revenue & Tax Summary */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] block mb-2">
                  FINANCIAL TOTALS & AUDIT
                </span>
                <div className="space-y-1 bg-white/[0.02] p-3 rounded-lg border border-white/[0.06]">
                  <div className="flex justify-between font-bold text-white">
                    <span>{t('staff.pos.gross_sales', 'Gross Sales:')}</span>
                    <span>{formatCurrency(selectedZReport.totalGrossSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('staff.pos.taxes_gst', 'Taxes (GST):')}</span>
                    <span>{formatCurrency(selectedZReport.totalTaxes)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-white">
                    <span>{t('staff.pos.net_sales', 'Net Sales:')}</span>
                    <span>{formatCurrency(selectedZReport.totalNetSales)}</span>
                  </div>
                  <div className="flex justify-between text-amber-300">
                    <span>{t('staff.pos.tips_collected', 'Tips Collected:')}</span>
                    <span>{formatCurrency(selectedZReport.totalTips)}</span>
                  </div>
                  <div className="flex justify-between text-stone-400">
                    <span>{t('staff.pos.discounts_given', 'Discounts Given:')}</span>
                    <span>-{formatCurrency(selectedZReport.totalDiscounts)}</span>
                  </div>
                  <div className="flex justify-between text-rose-400">
                    <span>{t('staff.pos.voids_refunds', 'Voids & Refunds:')}</span>
                    <span>-{formatCurrency(selectedZReport.totalVoids + selectedZReport.totalRefunds)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
