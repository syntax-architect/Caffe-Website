import { useI18n } from '../../i18n';
import React, { useState, useEffect } from 'react';
import type { OrderRecord } from '../../types/order';
import type {
  BillSplitPart,
  BillSplitSummary,
  SplitType,
  TenderType,
  SplitItemAllocation,
} from '../../types/billing';
import {
  getBillSplits,
  createBillSplit,
  processTenderPayment,
  voidOrRefundOrderSecure,
  generateIdempotencyKey,
} from '../../services/billingService';
import {
  calculateEqualSplit,
  calculateItemSplit,
  calculateCustomSplit,
  calculateCashChange,
  roundToCents,
} from '../../utils/billSplitCalculations';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { formatCurrency, getCurrencySymbol } from '../../utils/currency';
import { printCustomerReceipt, kickCashDrawer } from '../../utils/printReceipt';
import { getCurrentShift } from '../../services/cashDrawerService';
import { useSiteConfig } from '../../context/SiteConfigContext';

interface BillSettlementModalProps {
  order: OrderRecord;
  items: Array<{
    id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  onClose: () => void;
  onOrderUpdated: () => void;
}

export const BillSettlementModal: React.FC<BillSettlementModalProps> = ({
  order,
  items,
  onClose,
  onOrderUpdated,
}) => {
  const { t } = useI18n(); void t;
  const { user, role, isOwner, isManager } = useAuth();
  const { addNotification } = useNotification();
  const { restaurantConfig } = useSiteConfig();
  const features = restaurantConfig.features;
  const currency = order.currency || 'INR';
  const currencySymbol = getCurrencySymbol(currency);

  const [activeTab, setActiveTab] = useState<'pay' | 'split' | 'refund'>('pay');
  const [splitSummary, setSplitSummary] = useState<BillSplitSummary | null>(null);
  const [selectedPart, setSelectedPart] = useState<BillSplitPart | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeShiftId, setActiveShiftId] = useState<string | undefined>(undefined);

  // Split Configuration State
  const [splitMode, setSplitMode] = useState<SplitType>('equal');
  const [equalCount, setEqualCount] = useState<number>(2);
  const [customPartsInput, setCustomPartsInput] = useState<Array<{ payer_label: string; amount: number }>>([
    { payer_label: t('staff.billing.guest_1', 'Guest 1'), amount: roundToCents(order.total / 2) },
    { payer_label: t('staff.billing.guest_2', 'Guest 2'), amount: roundToCents(order.total - roundToCents(order.total / 2)) },
  ]);

  // Item split assignments: maps person index to array of items
  const [itemPersonCount, setItemPersonCount] = useState<number>(2);
  const [itemAssignments, setItemAssignments] = useState<Record<number, Record<string, number>>>({
    0: {},
    1: {},
  });

  // Payment Form State
  const [tenderType, setTenderType] = useState<TenderType>('cash');
  const [paymentAmount, setPaymentAmount] = useState<number>(order.total);
  const [tenderedAmount, setTenderedAmount] = useState<number>(order.total);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [currentIdempotencyKey, setCurrentIdempotencyKey] = useState<string>(() => generateIdempotencyKey('pmt'));

  // Refund State
  const [refundReason, setRefundReason] = useState<string>('Guest requested bill cancellation');
  const [refundAmount, setRefundAmount] = useState<number>(order.total);

  // Load existing splits and active shift
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setIsLoading(true);
      const tax = Math.max(0, roundToCents(order.total - order.subtotal));
      const summary = await getBillSplits(order.order_ref, order.total, order.subtotal, tax);
      const shift = await getCurrentShift();

      if (mounted) {
        setSplitSummary(summary);
        setActiveShiftId(shift?.id);
        if (summary.isSplit && summary.parts.length > 0) {
          const firstPending = summary.parts.find((p) => p.status === 'pending');
          if (firstPending) {
            setSelectedPart(firstPending);
            setPaymentAmount(firstPending.amount ?? 0);
            setTenderedAmount(firstPending.amount ?? 0);
          }
        } else {
          setPaymentAmount(order.total);
          setTenderedAmount(order.total);
        }
        setIsLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [order.order_ref, order.total, order.subtotal]);

  // Update payment amount when switching selected part
  const handleSelectPart = (part: BillSplitPart) => {
    setSelectedPart(part);
    setPaymentAmount(part.amount ?? 0);
    setTenderedAmount(part.amount ?? 0);
    setTipAmount(0);
    setPaymentReference('');
    setCurrentIdempotencyKey(generateIdempotencyKey(`pmt_part_${part.part_number}`));
  };

  // Live Change Calculation for Cash Tender
  const totalChargeWithTip = roundToCents(paymentAmount + tipAmount);
  const cashChange = calculateCashChange(totalChargeWithTip, tenderedAmount);

  // Handle Equal Split Creation
  const handleApplyEqualSplit = async () => {
    setIsProcessing(true);
    try {
      const tax = Math.max(0, roundToCents(order.total - order.subtotal));
      const calc = calculateEqualSplit(order.total, order.subtotal, tax, equalCount);
      const res = await createBillSplit(
        order.order_ref,
        order.total,
        order.subtotal,
        tax,
        'equal',
        calc.parts
      );

      if (res.success && res.summary) {
        setSplitSummary(res.summary);
        setSelectedPart(res.summary.parts[0] || null);
        setPaymentAmount(res.summary.parts[0]?.amount || 0);
        setTenderedAmount(res.summary.parts[0]?.amount || 0);
        setActiveTab('pay');
        addNotification('success', t('staff.billing.split_applied', 'Bill Split Applied'), t('staff.billing.split_into_equal_shares', 'Split into {n} equal shares.').replace('{n}', String(equalCount)));
        onOrderUpdated();
      } else {
        addNotification('error', t('staff.billing.split_failed', 'Split Failed'), res.error || t('staff.billing.could_not_split_bill', 'Could not split bill.'));
      }
    } catch (e: any) {
      addNotification('error', t('staff.billing.split_error', 'Split Error'), e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Custom Split Creation
  const handleApplyCustomSplit = async () => {
    setIsProcessing(true);
    try {
      const tax = Math.max(0, roundToCents(order.total - order.subtotal));
      const calc = calculateCustomSplit(order.total, order.subtotal, tax, customPartsInput);
      const res = await createBillSplit(
        order.order_ref,
        order.total,
        order.subtotal,
        tax,
        'custom',
        calc.parts
      );

      if (res.success && res.summary) {
        setSplitSummary(res.summary);
        setSelectedPart(res.summary.parts[0] || null);
        setPaymentAmount(res.summary.parts[0]?.amount || 0);
        setTenderedAmount(res.summary.parts[0]?.amount || 0);
        setActiveTab('pay');
        addNotification('success', t('staff.billing.custom_split_applied', 'Custom Split Applied'), t('staff.billing.created_custom_parts', 'Created {n} custom parts.').replace('{n}', String(customPartsInput.length)));
        onOrderUpdated();
      } else {
        addNotification('error', t('staff.billing.split_failed', 'Split Failed'), res.error || t('staff.billing.could_not_split_bill', 'Could not split bill.'));
      }
    } catch (e: any) {
      addNotification('error', t('staff.billing.split_error', 'Split Error'), e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Item Split Creation
  const handleApplyItemSplit = async () => {
    setIsProcessing(true);
    try {
      const tax = Math.max(0, roundToCents(order.total - order.subtotal));
      const payerGroups = Array.from({ length: itemPersonCount }).map((_, pIdx) => {
        const pItems: SplitItemAllocation[] = [];
        const personAssign = itemAssignments[pIdx] || {};

        for (const item of items) {
          const qty = personAssign[item.id] || 0;
          if (qty > 0) {
            pItems.push({
              id: item.id,
              name: item.item_name,
              quantity: qty,
              unit_price: item.unit_price,
              line_total: roundToCents(item.unit_price * qty),
            });
          }
        }

        return {
          payer_label: `${t('staff.billing.guest_prefix', 'Guest')} ${pIdx + 1}`,
          items: pItems,
        };
      });

      const calc = calculateItemSplit(order.total, order.subtotal, tax, payerGroups);
      const res = await createBillSplit(
        order.order_ref,
        order.total,
        order.subtotal,
        tax,
        'item',
        calc.parts
      );

      if (res.success && res.summary) {
        setSplitSummary(res.summary);
        setSelectedPart(res.summary.parts[0] || null);
        setPaymentAmount(res.summary.parts[0]?.amount || 0);
        setTenderedAmount(res.summary.parts[0]?.amount || 0);
        setActiveTab('pay');
        addNotification('success', t('staff.billing.item_split_applied', 'Item Split Applied'), t('staff.billing.items_allocated_guests', 'Items allocated across {n} guests.').replace('{n}', String(itemPersonCount)));
        onOrderUpdated();
      } else {
        addNotification('error', t('staff.billing.split_failed', 'Split Failed'), res.error || t('staff.billing.could_not_split_bill', 'Could not split bill.'));
      }
    } catch (e: any) {
      addNotification('error', t('staff.billing.split_error', 'Split Error'), e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit Payment with Idempotency Protection
  const handleProcessPayment = async () => {
    if (isProcessing) return;

    if (tenderType === 'cash' && !cashChange.isSufficient) {
      addNotification('error', t('staff.billing.insufficient_tender', 'Insufficient Tender'), t('staff.billing.tendered_amount_min', 'Tendered amount must be at least {amt}').replace('{amt}', formatCurrency(totalChargeWithTip)));
      return;
    }

    setIsProcessing(true);

    try {
      const res = await processTenderPayment({
        orderRef: order.order_ref,
        splitId: selectedPart?.id,
        tenderType,
        amount: paymentAmount,
        tipAmount,
        tenderedAmount: tenderType === 'cash' ? tenderedAmount : paymentAmount + tipAmount,
        paymentReference: paymentReference.trim() || undefined,
        idempotencyKey: currentIdempotencyKey,
        shiftId: activeShiftId,
        actorId: user?.id,
        actorName: user?.email || t('staff.billing.staff_cashier', 'Staff Cashier'),
        actorRole: role || 'staff',
      });

      if (res.success) {
        // Automatically pulse cash drawer on cash tender
        if (tenderType === 'cash') {
          kickCashDrawer().catch((err) => console.warn('[BillSettlement] Cash drawer kick notice:', err));
        }

        const changeMsg = res.changeDue > 0 ? ` (Change Due: ${formatCurrency(res.changeDue)})` : '';
        addNotification(
          'success',
          res.isDuplicate
            ? t('staff.settlement.payment_verified', 'Payment Already Verified')
            : t('staff.settlement.payment_recorded', 'Payment Recorded'),
          `Settled ${formatCurrency(res.amount)} via ${res.tenderType.toUpperCase()}${changeMsg}.`
        );

        // Refresh splits and order
        const tax = Math.max(0, roundToCents(order.total - order.subtotal));
        const updatedSummary = await getBillSplits(order.order_ref, order.total, order.subtotal, tax);
        setSplitSummary(updatedSummary);

        const nextPending = updatedSummary.parts.find((p) => p.status === 'pending');
        if (nextPending) {
          setSelectedPart(nextPending);
          setPaymentAmount(nextPending.amount ?? 0);
          setTenderedAmount(nextPending.amount ?? 0);
        } else {
          setSelectedPart(null);
        }

        // Generate fresh idempotency key for next transaction
        setCurrentIdempotencyKey(generateIdempotencyKey('pmt'));
        onOrderUpdated();

        if (res.isBillClosed) {
          addNotification('success', t('staff.billing.bill_settled', 'Bill Settled'), t('staff.billing.bill_ref_paid_closed', 'Bill #{ref} is completely paid and closed.').replace('{ref}', order.order_ref));
        }
      } else {
        addNotification('error', t('staff.billing.payment_failed', 'Payment Failed'), res.error || t('staff.billing.failed_record_payment', 'Failed to record payment.'));
      }
    } catch (e: any) {
      addNotification('error', t('staff.billing.payment_error', 'Payment Error'), e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Manager-Gated Refund / Void Handler
  const handleManagerRefund = async () => {
    if (!isOwner && !isManager) {
      addNotification('error', t('staff.billing.permission_denied', 'Permission Denied'), t('staff.billing.manager_role_required_refund', 'Manager or Owner role required to issue refunds or void paid tickets.'));
      return;
    }

    setIsProcessing(true);
    try {
      const res = await voidOrRefundOrderSecure({
        orderRef: order.order_ref,
        reason: refundReason,
        amount: refundAmount,
        actorId: user?.id || 'mgr',
        actorName: user?.email || t('staff.billing.manager', 'Manager'),
        actorRole: role || 'manager',
        shiftId: activeShiftId,
        isPaid: order.payment_status === 'paid',
      });

      if (res.success) {
        addNotification('success', t('staff.billing.refund_processed', 'Refund Processed'), t('staff.billing.order_refunded_audit', 'Order #{ref} refunded/voided and logged to audit trail.').replace('{ref}', order.order_ref));
        onOrderUpdated();
        onClose();
      } else {
        addNotification('error', t('staff.billing.refund_rejected', 'Refund Rejected'), res.error || t('staff.billing.could_not_process_refund', 'Could not process refund.'));
      }
    } catch (e: any) {
      addNotification('error', t('staff.billing.refund_error', 'Refund Error'), e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#120F0D] border border-white/[0.1] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] material-symbols-outlined">
              point_of_sale
            </span>
            <div>
              <h3 className="font-serif text-lg font-bold text-white flex items-center gap-2">
                {t('staff.billing.settlement_cockpit', 'Settlement Cockpit')} • #{order.order_ref}
                {order.payment_status === 'paid' && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {t('staff.billing.paid_and_closed', 'Paid & Closed')}
                  </span>
                )}
              </h3>
              <p className="text-xs text-stone-400">
                {order.order_type === 'dine_in' ? `${t('staff.billing.table', 'Table')} ${order.table_number || '--'}` : t('staff.billing.takeaway', 'Takeaway')} • {t('staff.billing.total', 'Total')}: {formatCurrency(order.total)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-stone-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/[0.08] px-6 bg-[#0c0a09]">
          <button
            type="button"
            onClick={() => setActiveTab('pay')}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'pay'
                ? 'border-[#D4AF37] text-[#F3C766]'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <span className="material-symbols-outlined text-sm">payments</span>
            {t('staff.settlement.take_payment', 'Take Payment')}
          </button>
          {features?.split_bills !== false && (
            <button
              type="button"
              onClick={() => setActiveTab('split')}
              className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'split'
                  ? 'border-[#D4AF37] text-[#F3C766]'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <span className="material-symbols-outlined text-sm">call_split</span>
              {t('staff.settlement.split_bill', 'Split Bill')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('refund')}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'refund'
                ? 'border-rose-500 text-rose-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <span className="material-symbols-outlined text-sm">shield</span>
            Manager Void / Refund
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="py-12 text-center text-stone-400 text-xs">
              <span className="material-symbols-outlined animate-spin text-2xl text-[#D4AF37] block mb-2">
                progress_activity
              </span>
              {t('staff.settlement.loading_billing_configuration', 'Loading billing configuration...')}
            </div>
          ) : (
            <>
              {/* -------------------- TAB 1: TAKE PAYMENT -------------------- */}
              {activeTab === 'pay' && (
                <div className="space-y-6">
                  {/* Split Parts Roster (if split) */}
                  {splitSummary?.isSplit && splitSummary.parts.length > 0 && (
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08]">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                          Select Payable Part ({splitSummary.parts.filter((p) => p.status === 'paid').length}/{splitSummary.parts.length} Paid)
                        </span>
                        <span className="text-xs font-mono text-amber-300">
                          Remaining: {formatCurrency(splitSummary.remainingBalance)}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {splitSummary.parts.map((part) => {
                          const isSelected = selectedPart?.id === part.id;
                          const isPaid = part.status === 'paid';
                          return (
                            <button
                              key={part.id}
                              type="button"
                              onClick={() => !isPaid && handleSelectPart(part)}
                              disabled={isPaid}
                              className={`p-3 rounded-xl border text-left transition-all relative ${
                                isPaid
                                  ? 'bg-emerald-950/20 border-emerald-500/30 opacity-70 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white'
                                  : 'bg-white/[0.03] border-white/[0.08] text-stone-300 hover:bg-white/[0.06]'
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold">{part.payer_label}</span>
                                {isPaid ? (
                                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">
                                    PAID ({part.tender_type})
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono text-amber-400">{t('staff.dashboard.due', 'DUE')}</span>
                                )}
                              </div>
                              <div className="text-sm font-mono font-bold text-white">
                                {formatCurrency(part.amount || 0)}
                              </div>
                              {part.items && part.items.length > 0 && (
                                <p className="text-[10px] text-stone-400 truncate mt-1">
                                  {part.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tender Selection */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-300 block mb-2">
                      {t('staff.settlement.choose_tender_type', 'Choose Tender Type')}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { type: 'cash' as const, label: t('staff.billing.tender_cash', 'Cash (Change)'), icon: 'payments' },
                        { type: 'card' as const, label: t('staff.billing.tender_card', 'Card (POS Slip)'), icon: 'credit_card' },
                        { type: 'upi' as const, label: t('staff.billing.tender_upi', 'UPI / QR'), icon: 'qr_code_2' },
                        { type: 'stripe' as const, label: t('staff.billing.tender_online', 'Stripe Online'), icon: 'link' },
                      ].map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setTenderType(item.type)}
                          className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                            tenderType === item.type
                              ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#F3C766] shadow-md'
                              : 'bg-white/[0.03] border-white/[0.08] text-stone-400 hover:text-white hover:bg-white/[0.06]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-xl">{item.icon}</span>
                          <span className="text-xs font-bold">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment Details Section */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Amount Due / Paying */}
                      <div>
                        <label className="text-xs text-stone-400 block mb-1">{t('staff.dashboard.amount_to_pay', 'Amount to Pay')}</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">
                            {currencySymbol}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(roundToCents(Number(e.target.value)))}
                            className="w-full bg-[#080706] border border-white/[0.1] focus:border-[#D4AF37] rounded-xl pl-7 pr-3 py-2 text-sm text-white font-mono focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Optional Tip Input */}
                      <div>
                        <label className="text-xs text-stone-400 block mb-1">{t('staff.dashboard.tip_amount_optional', 'Tip Amount (Optional)')}</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">
                            {currencySymbol}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={tipAmount || ''}
                            onChange={(e) => setTipAmount(roundToCents(Number(e.target.value)))}
                            className="w-full bg-[#080706] border border-white/[0.1] focus:border-[#D4AF37] rounded-xl pl-7 pr-3 py-2 text-sm text-white font-mono focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cash Tender Details & Change Calculation */}
                    {tenderType === 'cash' && (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-stone-300">{t('staff.dashboard.total_charge_bill_tip', 'Total Charge (Bill + Tip):')}</span>
                          <span className="font-mono font-bold text-white text-sm">
                            {formatCurrency(totalChargeWithTip, currency)}
                          </span>
                        </div>
                        <div>
                          <label className="text-xs text-stone-300 block mb-1">
                            {t('staff.settlement.cash_tendered_by_guest', 'Cash Tendered by Guest:')}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">
                              {currencySymbol}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={tenderedAmount}
                              onChange={(e) => setTenderedAmount(roundToCents(Number(e.target.value)))}
                              className="w-full bg-[#080706] border border-amber-500/50 focus:border-[#D4AF37] rounded-xl pl-7 pr-3 py-2 text-sm text-white font-mono focus:outline-none font-bold"
                            />
                          </div>
                        </div>

                        {/* Change Due Callout */}
                        <div className="flex justify-between items-center pt-2 border-t border-amber-500/20">
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                            {t('staff.settlement.change_due_to_guest', 'Change Due to Guest:')}
                          </span>
                          <span
                            className={`text-lg font-mono font-bold ${
                              cashChange.isSufficient ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {cashChange.isSufficient
                              ? formatCurrency(cashChange.changeDue)
                              : `Short by ${formatCurrency(cashChange.shortfall)}`}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Card Terminal Auth Reference */}
                    {tenderType === 'card' && (
                      <div>
                        <label className="text-xs text-stone-400 block mb-1">
                          Terminal Slip / Auth Approval Reference
                        </label>
                        <input
                          type="text"
                          placeholder={t('staff.dashboard.e_g_auth_981244_or_terminal_re', 'e.g. AUTH-981244 or Terminal Ref #')}
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          className="w-full bg-[#080706] border border-white/[0.1] focus:border-[#D4AF37] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                        />
                      </div>
                    )}

                    {/* UPI Reference */}
                    {tenderType === 'upi' && (
                      <div>
                        <label className="text-xs text-stone-400 block mb-1">
                          UPI Transaction ID / UTR Reference
                        </label>
                        <input
                          type="text"
                          placeholder={t('staff.dashboard.e_g_upi_1294801824_or_utr', 'e.g. UPI-1294801824 or UTR #')}
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          className="w-full bg-[#080706] border border-white/[0.1] focus:border-[#D4AF37] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Stripe Online Link */}
                    {tenderType === 'stripe' && (
                      <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-200">
                        <span className="font-bold block mb-1">{t('staff.dashboard.online_stripe_link', 'Online Stripe Link')}</span>
                        <p>
                          Generates an encrypted checkout session for guest to pay via card/Apple Pay on their own device.
                        </p>
                      </div>
                    )}

                    {/* Idempotency Token indicator */}
                    <div className="flex items-center justify-between text-[10px] text-stone-500 font-mono">
                      <span>Idempotency Key: {currentIdempotencyKey}</span>
                      <span>{t('staff.dashboard.double_tap_protected', 'Double-Tap Protected')}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isProcessing || (tenderType === 'cash' && !cashChange.isSufficient)}
                      onClick={handleProcessPayment}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] hover:from-[#c29f2f] hover:to-[#e0b555] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                          {t('staff.settlement.recording_settlement', 'Recording Settlement...')}
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          Record {tenderType.toUpperCase()} Payment ({formatCurrency(totalChargeWithTip)})
                        </>
                      )}
                    </button>
                    {features?.kot_printing !== false && (
                      <button
                        type="button"
                        onClick={() => {
                          printCustomerReceipt(order, items);
                        }}
                        className="py-3 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-stone-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title={t('staff.settlement.print_customer_bill', 'Print Customer Bill')}
                      >
                        <span className="material-symbols-outlined text-sm">receipt_long</span>
                        {t('staff.settlement.print_bill', 'Print Bill')}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* -------------------- TAB 2: SPLIT BILL -------------------- */}
              {activeTab === 'split' && (
                <div className="space-y-6">
                  {/* Split Type Selector */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { mode: 'equal' as const, label: t('staff.billing.equal_shares', 'Equal Shares'), desc: t('staff.billing.equal_shares_desc', 'Divide into N equal parts') },
                      { mode: 'item' as const, label: t('staff.billing.by_line_item', 'By Line Item'), desc: t('staff.billing.by_line_item_desc', 'Assign dishes to guests') },
                      { mode: 'custom' as const, label: t('staff.billing.custom_amount', 'Custom Amount'), desc: t('staff.billing.custom_amount_desc', 'Enter custom values') },
                    ].map((s) => (
                      <button
                        key={s.mode}
                        type="button"
                        onClick={() => setSplitMode(s.mode)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          splitMode === s.mode
                            ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white'
                            : 'bg-white/[0.03] border-white/[0.08] text-stone-400 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="text-xs font-bold text-white mb-0.5">{s.label}</div>
                        <div className="text-[10px] text-stone-400">{s.desc}</div>
                      </button>
                    ))}
                  </div>

                  {/* Mode 1: Equal Split */}
                  {splitMode === 'equal' && (
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-stone-300 font-bold uppercase tracking-wider">
                          {t('staff.settlement.number_of_guests_n_people', 'Number of Guests (N People):')}
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEqualCount(Math.max(2, equalCount - 1))}
                            className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white flex items-center justify-center font-bold"
                          >
                            -
                          </button>
                          <span className="w-10 text-center font-mono font-bold text-white text-base">
                            {equalCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEqualCount(Math.min(20, equalCount + 1))}
                            className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white flex items-center justify-center font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Equal Split Preview */}
                      {(() => {
                        const tax = Math.max(0, roundToCents(order.total - order.subtotal));
                        const calc = calculateEqualSplit(order.total, order.subtotal, tax, equalCount);
                        return (
                          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                            <span className="text-[10px] text-stone-400 uppercase font-mono">
                              Exact Cent Breakdown (Total: {formatCurrency(calc.totalAmount)})
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {calc.parts.map((p) => (
                                <div key={p.part_number} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                                  <div className="text-[11px] font-bold text-stone-300">{p.payer_label}</div>
                                  <div className="text-xs font-mono font-bold text-[#F3C766]">
                                    {formatCurrency(p.amount)}
                                  </div>
                                  <div className="text-[9px] text-stone-500 font-mono">
                                    Sub: {formatCurrency(p.subtotal, currency)} • Tax: {formatCurrency(p.tax_amount, currency)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={handleApplyEqualSplit}
                        className="w-full py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c29f2f] text-black font-bold text-xs uppercase tracking-wider transition-all"
                      >
                        Apply {equalCount}-Way Equal Split
                      </button>
                    </div>
                  )}

                  {/* Mode 2: By Item Split */}
                  {splitMode === 'item' && (
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                          {t('staff.settlement.number_of_guest_shares', 'Number of Guest Shares:')}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setItemPersonCount(Math.max(2, itemPersonCount - 1))}
                            className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white flex items-center justify-center font-bold"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-mono font-bold text-white text-sm">
                            {itemPersonCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => setItemPersonCount(Math.min(10, itemPersonCount + 1))}
                            className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white flex items-center justify-center font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Items Allocation Table */}
                      <div className="space-y-3">
                        {items.map((item) => (
                          <div key={item.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-bold text-white">
                                {item.quantity}x {item.item_name}
                              </span>
                              <span className="font-mono text-[#F3C766]">
                                {formatCurrency(item.line_total)}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {Array.from({ length: itemPersonCount }).map((_, pIdx) => {
                                const currentAlloc = itemAssignments[pIdx]?.[item.id] || 0;
                                return (
                                  <div key={pIdx} className="flex items-center justify-between p-1.5 rounded bg-black/40 border border-white/5">
                                    <span className="text-[10px] text-stone-400 font-mono">G{pIdx + 1}:</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max={item.quantity}
                                      value={currentAlloc}
                                      onChange={(e) => {
                                        const val = Math.max(0, Math.min(item.quantity, Number(e.target.value) || 0));
                                        setItemAssignments((prev) => ({
                                          ...prev,
                                          [pIdx]: {
                                            ...(prev[pIdx] || {}),
                                            [item.id]: val,
                                          },
                                        }));
                                      }}
                                      className="w-12 bg-transparent text-right font-mono text-xs text-white focus:outline-none"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={handleApplyItemSplit}
                        className="w-full py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c29f2f] text-black font-bold text-xs uppercase tracking-wider transition-all"
                      >
                        {t('staff.settlement.apply_itemized_split_with_propor', 'Apply Itemized Split with Proportional Tax')}
                      </button>
                    </div>
                  )}

                  {/* Mode 3: Custom Split */}
                  {splitMode === 'custom' && (
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                          {t('staff.settlement.custom_amounts_by_payer', 'Custom Amounts by Payer')}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCustomPartsInput((prev) => [
                              ...prev,
                              { payer_label: `Guest ${prev.length + 1}`, amount: 0 },
                            ])
                          }
                          className="text-xs text-[#F3C766] hover:underline"
                        >
                          + Add Payer
                        </button>
                      </div>

                      <div className="space-y-2">
                        {customPartsInput.map((cp, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={cp.payer_label}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCustomPartsInput((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, payer_label: val } : item))
                                );
                              }}
                              className="flex-1 bg-[#080706] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white"
                            />
                            <div className="relative w-36">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">
                                {currencySymbol}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                value={cp.amount || ''}
                                onChange={(e) => {
                                  const val = roundToCents(Number(e.target.value));
                                  setCustomPartsInput((prev) =>
                                    prev.map((item, i) => (i === idx ? { ...item, amount: val } : item))
                                  );
                                }}
                                className="w-full bg-[#080706] border border-white/[0.1] rounded-xl pl-7 pr-3 py-2 text-xs text-white font-mono text-right"
                              />
                            </div>
                            {customPartsInput.length > 2 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setCustomPartsInput((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="p-2 text-stone-500 hover:text-rose-400"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Cent Sum Check */}
                      {(() => {
                        const sum = roundToCents(customPartsInput.reduce((s, p) => s + (p.amount || 0), 0));
                        const diff = roundToCents(order.total - sum);
                        const isExact = Math.abs(diff) < 0.009;
                        return (
                          <div className={`p-2.5 rounded-xl border flex justify-between items-center text-xs ${
                            isExact ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                          }`}>
                            <span>Sum: {formatCurrency(sum)} / {formatCurrency(order.total)}</span>
                            <span>{isExact ? '✔ Exact Cent Match' : `Discrepancy: ${formatCurrency(diff)}`}</span>
                          </div>
                        );
                      })()}

                      <button
                        type="button"
                        disabled={isProcessing || Math.abs(order.total - customPartsInput.reduce((s, p) => s + (p.amount || 0), 0)) > 0.009}
                        onClick={handleApplyCustomSplit}
                        className="w-full py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c29f2f] text-black font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                      >
                        {t('staff.settlement.apply_custom_split', 'Apply Custom Split')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* -------------------- TAB 3: MANAGER REFUND / VOID -------------------- */}
              {activeTab === 'refund' && (
                <div className="space-y-4">
                  {!isOwner && !isManager ? (
                    <div className="p-6 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-center space-y-2">
                      <span className="material-symbols-outlined text-3xl text-rose-400">shield_lock</span>
                      <h4 className="font-bold text-sm text-white">{t('staff.dashboard.manager_authorization_required', 'Manager Authorization Required')}</h4>
                      <p className="text-xs text-rose-200">
                        {t('staff.settlement.refunds_and_post_payment_voiding', 'Refunds and post-payment voiding require Manager or Owner role credentials. Standard staff cannot perform cancellations after settlement.')}
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-rose-950/15 border border-rose-500/20 space-y-4">
                      <div className="flex items-center gap-2 text-rose-300 text-xs font-bold">
                        <span className="material-symbols-outlined text-base">verified_user</span>
                        {t('staff.billing.manager_clearance_verified', 'Manager Clearance Verified ({email})').replace('{email}', user?.email || t('staff.billing.manager', 'Manager'))}
                      </div>

                      <div>
                        <label className="text-xs text-stone-300 block mb-1">{t('staff.dashboard.cancellation_refund_reason', 'Cancellation / Refund Reason')}</label>
                        <select
                          value={refundReason}
                          onChange={(e) => setRefundReason(e.target.value)}
                          className="w-full bg-[#080706] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                        >
                          <option value="Guest requested bill cancellation">{t('staff.dashboard.guest_requested_bill_cancellat', 'Guest requested bill cancellation')}</option>
                          <option value="Billing / amount discrepancy corrected">{t('staff.dashboard.billing_amount_discrepancy_cor', 'Billing / amount discrepancy corrected')}</option>
                          <option value="Kitchen quality issue / remake refused">{t('staff.dashboard.kitchen_quality_issue_remake_r', 'Kitchen quality issue / remake refused')}</option>
                          <option value="Duplicate charge accidental tender">{t('staff.dashboard.duplicate_charge_accidental_te', 'Duplicate charge accidental tender')}</option>
                          <option value="Other manager authorized refund">{t('staff.dashboard.other_manager_authorized_refun', 'Other manager authorized refund')}</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-stone-300 block mb-1">{t('staff.dashboard.refund_amount', 'Refund Amount')}</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">
                            {currencySymbol}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(roundToCents(Number(e.target.value)))}
                            className="w-full bg-[#080706] border border-white/[0.1] rounded-xl pl-7 pr-3 py-2 text-sm text-white font-mono focus:outline-none font-bold"
                          />
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-black/40 text-[11px] text-stone-400 space-y-1">
                        <div>{t('staff.dashboard.this_operation_will_write_an_i', '• This operation will write an immutable record to the security audit trail.')}</div>
                        <div>{t('staff.dashboard.if_cash_settlement_a_cash_refu', '• If cash settlement, a cash refund transaction is recorded in the active shift drawer.')}</div>
                      </div>

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={handleManagerRefund}
                        className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer disabled:opacity-50"
                      >
                        {isProcessing ? t('staff.billing.processing_refund', 'Processing Refund...') : t('staff.billing.authorize_refund', 'Authorize & Issue Refund ({amt})').replace('{amt}', formatCurrency(refundAmount))}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
