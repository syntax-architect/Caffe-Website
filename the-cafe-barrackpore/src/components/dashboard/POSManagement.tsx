import { useI18n } from '../../i18n';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { useSiteConfig } from '../../context/SiteConfigContext';
import { fetchMenuItems, fetchMenuCategories } from '../../services/menuService';
import {
  fetchPOSTablesAndBills,
  createOrAppendKOT,
  transferTable,
  mergeTables,
  moveItemsBetweenBills,
  voidBillItem,
  markBillPrinted,
  settleBill,
  verifyManagerPinLocally,
  DEFAULT_MODIFIERS,
} from '../../services/posService';
import { validateDiscountCode } from '../../services/ownerService';
import { printCustomerReceipt, printKitchenKOT } from '../../utils/printReceipt';
import { calculateTaxBreakdown, roundCurrency } from '../../utils/taxEngine';
import type { MenuItem, MenuCategory } from '../../types/menu';
import type {
  POSBill,
  POSBillItem,
  POSTableMapItem,
  POSOrderType,
  POSPaymentMethod,
  POSModifier,
} from '../../types/pos';
import type { TaxConfiguration } from '../../types/tax';

interface CartDraftItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  modifiers: POSModifier[];
  notes: string;
  taxCategory?: string;
}

export const POSManagement: React.FC = () => {
  const { t } = useI18n(); void t;
  const { isOwner, isManager } = useAuth();
  const { addNotification } = useNotification();
  const { restaurantConfig } = useSiteConfig();
  const features = restaurantConfig.features;
  const currencySymbol = restaurantConfig.currencySymbol || '₹';

  // Mode: Floor Table Map vs Direct Counter POS
  const [activeTab, setActiveTab] = useState<'tables' | 'counter'>('tables');

  // Floor & Tables state
  const [tables, setTables] = useState<POSTableMapItem[]>([]);
  const [counterBills, setCounterBills] = useState<POSBill[]>([]);
  const [selectedTable, setSelectedTable] = useState<POSTableMapItem | null>(null);
  const [isLoadingTables, setIsLoadingTables] = useState<boolean>(true);
  const [tableFilter, setTableFilter] = useState<'all' | 'free' | 'running' | 'printed'>('all');

  // Menu Catalog & Categories
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active Bill & Order State
  const [activeBill, setActiveBill] = useState<POSBill | null>(null);
  const [orderType, setOrderType] = useState<POSOrderType>('dine_in');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [specialInstructions, setSpecialInstructions] = useState<string>('');

  // New Items to be punched in next KOT batch
  const [draftItems, setDraftItems] = useState<CartDraftItem[]>([]);

  // Item Customizer Modal (for modifiers & cooking notes)
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [customizerQuantity, setCustomizerQuantity] = useState<number>(1);
  const [customizerModifiers, setCustomizerModifiers] = useState<POSModifier[]>([]);
  const [customizerNotes, setCustomizerNotes] = useState<string>('');

  // Discounts
  const [discountCodeInput, setDiscountCodeInput] = useState<string>('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    type: 'percentage' | 'flat' | 'manual';
    value: number;
    code?: string;
    amount: number;
    approvedBy?: string;
  } | null>(null);
  const [isManualDiscountModalOpen, setIsManualDiscountModalOpen] = useState<boolean>(false);
  const [manualDiscountType, setManualDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [manualDiscountValue, setManualDiscountValue] = useState<number>(10);
  const [manualDiscountReason, setManualDiscountReason] = useState<string>('');
  const [manualDiscountPin, setManualDiscountPin] = useState<string>('');

  // Table Operations Modals
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferTargetTable, setTransferTargetTable] = useState<string>('');

  const [isMergeModalOpen, setIsMergeModalOpen] = useState<boolean>(false);
  const [mergeTargetBillId, setMergeTargetBillId] = useState<string>('');

  const [isMoveItemsModalOpen, setIsMoveItemsModalOpen] = useState<boolean>(false);
  const [moveTargetBillId, setMoveTargetBillId] = useState<string>('');
  const [moveSelectedItems, setMoveSelectedItems] = useState<string[]>([]);

  // Void Modal
  const [voidingItem, setVoidingItem] = useState<POSBillItem | null>(null);
  const [voidReason, setVoidReason] = useState<string>('Guest changed mind');
  const [voidCustomReason, setVoidCustomReason] = useState<string>('');
  const [voidManagerPin, setVoidManagerPin] = useState<string>('');
  const [isSubmittingVoid, setIsSubmittingVoid] = useState<boolean>(false);

  // Settlement & Payment Modal
  const [isSettleModalOpen, setIsSettleModalOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<POSPaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [isSettling, setIsSettling] = useState<boolean>(false);

  // KOT Punch in progress
  const [isPunchingKOT, setIsPunchingKOT] = useState<boolean>(false);

  // -------------------------------------------------------------
  // Load Tables & Menu Catalog
  // -------------------------------------------------------------
  const refreshFloorData = useCallback(async () => {
    try {
      const data = await fetchPOSTablesAndBills();
      setTables(data.tables);
      setCounterBills(data.counterBills);

      // Keep activeBill refreshed if open
      if (activeBill) {
        if (activeBill.order_type === 'dine_in' && activeBill.table_number) {
          const updatedTable = data.tables.find((t) => t.table_number === activeBill.table_number);
          if (updatedTable && updatedTable.current_bill) {
            setActiveBill(updatedTable.current_bill);
          }
        } else {
          const updatedCounter = data.counterBills.find((b) => b.id === activeBill.id);
          if (updatedCounter) {
            setActiveBill(updatedCounter);
          }
        }
      }
    } catch (err) {
      console.error('[POSManagement] Failed to refresh floor data:', err);
    } finally {
      setIsLoadingTables(false);
    }
  }, [activeBill]);

  useEffect(() => {
    refreshFloorData();
    fetchMenuItems().then(setMenuItems);
    fetchMenuCategories().then(setCategories);
  }, []);

  // Poll floor state every 15s to keep table map synced with waiter/QR tablets
  useEffect(() => {
    const interval = setInterval(refreshFloorData, 15000);
    return () => clearInterval(interval);
  }, [refreshFloorData]);

  // -------------------------------------------------------------
  // Tax Configuration Single Source of Truth
  // -------------------------------------------------------------
  const taxConfig: TaxConfiguration = useMemo(() => {
    if (restaurantConfig?.tax) {
      return restaurantConfig.tax;
    }
    return {
      enabled: true,
      mode: 'inclusive',
      label: 'GST',
      rate: 0.05,
      rules: [
        { label: 'CGST', rate: 0.025, mode: 'inclusive' },
        { label: 'SGST', rate: 0.025, mode: 'inclusive' },
      ],
    };
  }, [restaurantConfig]);

  // -------------------------------------------------------------
  // Filtered Menu Items
  // -------------------------------------------------------------
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (item.available === false) return false;
      const matchesCategory =
        selectedCategory === 'all' ||
        item.category_id === selectedCategory ||
        item.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // -------------------------------------------------------------
  // Table Selection & Bill Activation
  // -------------------------------------------------------------
  const handleSelectTable = (tableItem: POSTableMapItem) => {
    setSelectedTable(tableItem);
    if (tableItem.current_bill) {
      setActiveBill(tableItem.current_bill);
      setOrderType('dine_in');
      setCustomerName(tableItem.current_bill.customer_name || '');
      setCustomerPhone(tableItem.current_bill.customer_phone || '');
      setDraftItems([]);
      setAppliedDiscount(
        tableItem.current_bill.discount_amount
          ? {
              type: tableItem.current_bill.discount_type || 'flat',
              value: tableItem.current_bill.discount_value || 0,
              code: tableItem.current_bill.discount_code || undefined,
              amount: tableItem.current_bill.discount_amount || 0,
              approvedBy: tableItem.current_bill.discount_approved_by || undefined,
            }
          : null
      );
    } else {
      // Free table: prepare new bill
      setActiveBill(null);
      setOrderType('dine_in');
      setCustomerName('');
      setCustomerPhone('');
      setDraftItems([]);
      setAppliedDiscount(null);
    }
  };

  const handleStartCounterBill = (type: POSOrderType = 'takeaway') => {
    setActiveTab('counter');
    setSelectedTable(null);
    setActiveBill(null);
    setOrderType(type);
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setDraftItems([]);
    setAppliedDiscount(null);
  };

  // -------------------------------------------------------------
  // Item Addition & Customization
  // -------------------------------------------------------------
  const handleQuickAddItem = (item: MenuItem) => {
    setDraftItems((prev) => {
      const existingIdx = prev.findIndex(
        (d) => d.id === item.id && d.modifiers.length === 0 && !d.notes
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].quantity += 1;
        return copy;
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          quantity: 1,
          price: Number(item.price) || 0,
          modifiers: [],
          notes: '',
          taxCategory: 'food',
        },
      ];
    });
  };

  const handleOpenCustomizer = (item: MenuItem) => {
    setCustomizingItem(item);
    setCustomizerQuantity(1);
    setCustomizerModifiers([]);
    setCustomizerNotes('');
  };

  const handleToggleModifier = (modifier: POSModifier) => {
    setCustomizerModifiers((prev) => {
      const exists = prev.some((m) => m.id === modifier.id);
      if (exists) {
        return prev.filter((m) => m.id !== modifier.id);
      }
      return [...prev, modifier];
    });
  };

  const handleConfirmCustomizer = () => {
    if (!customizingItem) return;
    setDraftItems((prev) => [
      ...prev,
      {
        id: customizingItem.id,
        name: customizingItem.name,
        quantity: Math.max(1, customizerQuantity),
        price: Number(customizingItem.price) || 0,
        modifiers: [...customizerModifiers],
        notes: customizerNotes.trim(),
        taxCategory: 'food',
      },
    ]);
    setCustomizingItem(null);
  };

  const handleUpdateDraftQuantity = (index: number, delta: number) => {
    setDraftItems((prev) => {
      const copy = [...prev];
      const nextQty = copy[index].quantity + delta;
      if (nextQty <= 0) {
        return copy.filter((_, i) => i !== index);
      }
      copy[index].quantity = nextQty;
      return copy;
    });
  };

  const handleRemoveDraftItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== index));
  };

  // -------------------------------------------------------------
  // Live Financial Calculation (Active Bill + Draft Items)
  // -------------------------------------------------------------
  const liveTotals = useMemo(() => {
    // 1. Existing bill items (non-voided)
    const existingActiveItems = (activeBill?.items || []).filter((it) => !it.is_voided);
    let existingSubtotal = 0;
    const allTaxableItems: { amount: number; quantity: number; category: any }[] = [];

    existingActiveItems.forEach((it) => {
      let unitPrice = Number(it.unit_price) || 0;
      if (it.modifiers && Array.isArray(it.modifiers)) {
        it.modifiers.forEach((m) => {
          unitPrice += Number(m.price) || 0;
        });
      }
      const lineTotal = roundCurrency(unitPrice * it.quantity);
      existingSubtotal += lineTotal;
      allTaxableItems.push({
        amount: unitPrice,
        quantity: it.quantity,
        category: (it.tax_category as any) || 'food',
      });
    });

    // 2. Draft items
    let draftSubtotal = 0;
    draftItems.forEach((it) => {
      let unitPrice = Number(it.price) || 0;
      it.modifiers.forEach((m) => {
        unitPrice += Number(m.price) || 0;
      });
      const lineTotal = roundCurrency(unitPrice * it.quantity);
      draftSubtotal += lineTotal;
      allTaxableItems.push({
        amount: unitPrice,
        quantity: it.quantity,
        category: (it.taxCategory as any) || 'food',
      });
    });

    const combinedSubtotal = roundCurrency(existingSubtotal + draftSubtotal);

    // 3. Discount calculation
    let discountAmount = 0;
    if (appliedDiscount) {
      if (appliedDiscount.type === 'percentage') {
        discountAmount = roundCurrency(combinedSubtotal * (appliedDiscount.value / 100));
      } else {
        discountAmount = Math.min(combinedSubtotal, appliedDiscount.value);
      }
    }

    const netSubtotal = Math.max(0, roundCurrency(combinedSubtotal - discountAmount));

    // Tax Engine calculation
    const breakdown = calculateTaxBreakdown(allTaxableItems, taxConfig);

    return {
      subtotal: combinedSubtotal,
      discountAmount,
      netSubtotal,
      taxAmount: breakdown.totalTax,
      taxBreakdownLines: breakdown.lines,
      serviceCharge: breakdown.serviceCharge || 0,
      grandTotal: netSubtotal,
      existingCount: existingActiveItems.reduce((acc, it) => acc + (it.quantity || 1), 0),
      draftCount: draftItems.reduce((acc, it) => acc + it.quantity, 0),
    };
  }, [activeBill, draftItems, appliedDiscount, taxConfig]);

  // -------------------------------------------------------------
  // Punch KOT (Send Batch to Kitchen)
  // -------------------------------------------------------------
  const handlePunchKOT = async () => {
    if (isPunchingKOT) return;

    if (draftItems.length === 0) {
      addNotification('warning', 'No Items', 'Please select at least one item before sending a KOT.');
      return;
    }

    if (orderType === 'dine_in' && !selectedTable?.table_number && !activeBill?.table_number) {
      addNotification('warning', 'Missing Table', 'Please pick a dining table for Dine-In orders.');
      return;
    }

    setIsPunchingKOT(true);
    try {
      const tableNum =
        orderType === 'dine_in'
          ? activeBill?.table_number || selectedTable?.table_number || null
          : null;

      const res = await createOrAppendKOT({
        billId: activeBill?.id,
        orderType,
        tableNumber: tableNum,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        items: draftItems,
        specialInstructions: specialInstructions.trim() || undefined,
        taxConfig,
      });

      if (!res.success) {
        addNotification('error', 'KOT Failed', res.error || 'Failed to dispatch KOT ticket.');
        return;
      }

      addNotification(
        'success',
        `KOT #${res.kotBatch.batch_index} Sent`,
        `Fired ticket ${res.kotBatch.kot_number} to Kitchen Display.`
      );

      // Print KOT automatically or optionally if thermal printing is enabled
      if (features?.kot_printing !== false) {
        try {
          printKitchenKOT({
          order_ref: res.kotBatch.kot_number,
          order_type: orderType,
          table_number: tableNum,
          customer_name: customerName || (tableNum ? `Table ${tableNum}` : 'Counter Guest'),
          created_at: new Date().toISOString(),
          special_requests: specialInstructions || undefined,
          items: draftItems.map((it) => ({
            item_name: it.name,
            quantity: it.quantity,
            selected_options: {
              notes: it.notes || '',
              modifiers: it.modifiers.map((m) => m.name).join(', '),
            },
          })),
        });
        } catch (printErr) {
          console.warn('Silent print skipped:', printErr);
        }
      }

      // Update state
      setActiveBill(res.bill);
      setDraftItems([]);
      setSpecialInstructions('');
      await refreshFloorData();
    } catch (err: any) {
      addNotification('error', 'Execution Error', err?.message || 'Error creating KOT.');
    } finally {
      setIsPunchingKOT(false);
    }
  };

  // -------------------------------------------------------------
  // Discount Application & Validation
  // -------------------------------------------------------------
  const handleApplyPromoCode = async () => {
    const code = discountCodeInput.trim().toUpperCase();
    if (!code) return;

    try {
      const res = await validateDiscountCode(code, liveTotals.subtotal);
      if (!res.valid) {
        addNotification('error', 'Invalid Code', res.error || 'Discount code cannot be applied.');
        return;
      }

      setAppliedDiscount({
        type: res.discount_type || 'flat',
        value: res.discount_value || 0,
        code: res.code,
        amount: res.discount_amount || 0,
      });
      setDiscountCodeInput('');
      addNotification('success', 'Discount Applied', `Promo code ${code} applied successfully!`);
    } catch {
      addNotification('error', 'Error', 'Failed to validate discount code.');
    }
  };

  const handleApplyManualDiscount = () => {
    if (!manualDiscountReason.trim()) {
      addNotification('warning', 'Reason Required', 'Please provide an audit reason for manual discount.');
      return;
    }

    // Verify Manager PIN if not already logged in as Owner or Manager
    const isPrivileged = Boolean(isOwner || isManager);
    if (!isPrivileged) {
      const isPinOk = verifyManagerPinLocally(manualDiscountPin);
      if (!isPinOk) {
        addNotification('error', 'Unauthorized', 'Invalid Manager PIN.');
        return;
      }
    }

    let amt = 0;
    if (manualDiscountType === 'percentage') {
      amt = roundCurrency(liveTotals.subtotal * (manualDiscountValue / 100));
    } else {
      amt = Math.min(liveTotals.subtotal, manualDiscountValue);
    }

    setAppliedDiscount({
      type: 'manual',
      value: manualDiscountValue,
      amount: amt,
      approvedBy: isPrivileged ? 'Manager (Authenticated Role)' : `Manager (PIN Verified) - ${manualDiscountReason}`,
    });

    setIsManualDiscountModalOpen(false);
    setManualDiscountPin('');
    setManualDiscountReason('');
    addNotification('success', 'Manager Discount Approved', `Manual discount of ${currencySymbol}${amt} applied.`);
  };

  // -------------------------------------------------------------
  // Void Item Handler
  // -------------------------------------------------------------
  const handleConfirmVoid = async () => {
    if (!voidingItem || !activeBill) return;

    const chosenReason =
      voidReason === 'Other' ? voidCustomReason.trim() : voidReason.trim();

    if (!chosenReason) {
      addNotification('warning', 'Reason Required', 'Please specify a valid reason for voiding this item.');
      return;
    }

    setIsSubmittingVoid(true);
    try {
      const isPrivileged = Boolean(isOwner || isManager);
      const res = await voidBillItem({
        billId: activeBill.id,
        itemId: voidingItem.id,
        reason: chosenReason,
        managerPin: isPrivileged ? '1234' : voidManagerPin,
        itemPrice: voidingItem.line_total,
      });

      if (!res.success) {
        addNotification('error', 'Void Denied', res.error || 'Failed to void item.');
        return;
      }

      addNotification(
        'success',
        'Item Voided',
        `"${voidingItem.item_name}" has been removed and audited.`
      );

      setVoidingItem(null);
      setVoidManagerPin('');
      setVoidCustomReason('');
      await refreshFloorData();
    } catch (err: any) {
      addNotification('error', 'Void Error', err?.message || 'Error processing void.');
    } finally {
      setIsSubmittingVoid(false);
    }
  };

  // -------------------------------------------------------------
  // Table Operations: Transfer Table
  // -------------------------------------------------------------
  const handleConfirmTransfer = async () => {
    if (!activeBill || !transferTargetTable.trim()) return;

    try {
      const res = await transferTable(activeBill.id, transferTargetTable.trim());
      if (!res.success) {
        addNotification('error', 'Transfer Failed', res.error || 'Could not transfer table.');
        return;
      }

      addNotification(
        'success',
        'Table Transferred',
        `Bill moved from Table ${activeBill.table_number} to Table ${transferTargetTable}.`
      );

      setIsTransferModalOpen(false);
      setTransferTargetTable('');
      await refreshFloorData();
    } catch (err: any) {
      addNotification('error', 'Error', err?.message || 'Table transfer failed.');
    }
  };

  // -------------------------------------------------------------
  // Table Operations: Merge Tables
  // -------------------------------------------------------------
  const handleConfirmMerge = async () => {
    if (!activeBill || !mergeTargetBillId) return;

    try {
      const res = await mergeTables(activeBill.id, mergeTargetBillId);
      if (!res.success) {
        addNotification('error', 'Merge Failed', res.error || 'Could not merge tables.');
        return;
      }

      addNotification(
        'success',
        'Tables Merged',
        `Table ${activeBill.table_number} successfully merged into target table.`
      );

      setIsMergeModalOpen(false);
      setMergeTargetBillId('');
      setActiveBill(null);
      setSelectedTable(null);
      await refreshFloorData();
    } catch (err: any) {
      addNotification('error', 'Error', err?.message || 'Table merge failed.');
    }
  };

  // -------------------------------------------------------------
  // Table Operations: Move Specific Items
  // -------------------------------------------------------------
  const handleConfirmMoveItems = async () => {
    if (!activeBill || !moveTargetBillId || moveSelectedItems.length === 0) return;

    try {
      const res = await moveItemsBetweenBills(activeBill.id, moveTargetBillId, moveSelectedItems);
      if (!res.success) {
        addNotification('error', 'Move Failed', res.error || 'Could not move items.');
        return;
      }

      addNotification(
        'success',
        'Items Moved',
        `Moved ${moveSelectedItems.length} item(s) to destination table.`
      );

      setIsMoveItemsModalOpen(false);
      setMoveTargetBillId('');
      setMoveSelectedItems([]);
      await refreshFloorData();
    } catch (err: any) {
      addNotification('error', 'Error', err?.message || 'Moving items failed.');
    }
  };

  // -------------------------------------------------------------
  // Print Bill
  // -------------------------------------------------------------
  const handlePrintCustomerBill = async () => {
    if (!activeBill) return;

    try {
      await markBillPrinted(activeBill.id);

      const printableData = {
        order_ref: activeBill.bill_number,
        order_type: activeBill.order_type,
        table_number: activeBill.table_number,
        customer_name: activeBill.customer_name || (activeBill.table_number ? `Table ${activeBill.table_number}` : 'Guest'),
        customer_phone: activeBill.customer_phone || undefined,
        created_at: activeBill.created_at,
        subtotal: liveTotals.subtotal,
        discount_amount: liveTotals.discountAmount,
        total: liveTotals.grandTotal,
        payment_status: 'unpaid',
        items: (activeBill.items || [])
          .filter((it) => !it.is_voided)
          .map((it) => ({
            item_name: it.item_name,
            quantity: it.quantity,
            unit_price: it.unit_price,
            line_total: it.line_total,
            selected_options: {
              notes: it.notes || '',
              modifiers: (it.modifiers || []).map((m) => m.name).join(', '),
            },
          })),
      };

      printCustomerReceipt(printableData);
      addNotification('success', 'Bill Printed', 'Sent bill receipt to thermal printer.');
      await refreshFloorData();
    } catch (err) {
      console.error('Print error:', err);
      addNotification('error', 'Print Error', 'Failed to generate printable bill.');
    }
  };

  // -------------------------------------------------------------
  // Settle Bill & Payment
  // -------------------------------------------------------------
  const handleConfirmSettleBill = async () => {
    if (!activeBill) return;

    setIsSettling(true);
    try {
      const res = await settleBill({
        billId: activeBill.id,
        paymentMethod,
        discountType: appliedDiscount?.type,
        discountValue: appliedDiscount?.value,
        discountCode: appliedDiscount?.code,
        discountAmount: liveTotals.discountAmount,
        discountApprovedBy: appliedDiscount?.approvedBy,
        taxConfig,
      });

      if (!res.success) {
        addNotification('error', 'Settlement Failed', res.error || 'Failed to settle bill.');
        return;
      }

      addNotification(
        'success',
        'Bill Paid & Settled',
        `Bill ${activeBill.bill_number} settled via ${paymentMethod.toUpperCase()} (${currencySymbol}${res.grandTotal}). Table freed!`
      );

      // Print final customer paid receipt
      try {
        printCustomerReceipt({
          order_ref: activeBill.bill_number,
          order_type: activeBill.order_type,
          table_number: activeBill.table_number,
          customer_name: activeBill.customer_name || 'Guest',
          customer_phone: activeBill.customer_phone || undefined,
          created_at: activeBill.created_at,
          paid_at: new Date().toISOString(),
          payment_status: 'paid',
          payment_method: paymentMethod,
          subtotal: liveTotals.subtotal,
          discount_amount: liveTotals.discountAmount,
          total: liveTotals.grandTotal,
          items: (activeBill.items || [])
            .filter((it) => !it.is_voided)
            .map((it) => ({
              item_name: it.item_name,
              quantity: it.quantity,
              unit_price: it.unit_price,
              line_total: it.line_total,
            })),
        });
      } catch (err) {
        console.warn('Receipt print skipped:', err);
      }

      setIsSettleModalOpen(false);
      setCashTendered('');
      setActiveBill(null);
      setSelectedTable(null);
      setDraftItems([]);
      setAppliedDiscount(null);
      await refreshFloorData();
    } catch (err: any) {
      addNotification('error', 'Error', err?.message || 'Payment settlement failed.');
    } finally {
      setIsSettling(false);
    }
  };

  // Helper calculation for cash tendered
  const cashChangeDue = useMemo(() => {
    const tendered = parseFloat(cashTendered);
    if (isNaN(tendered) || tendered <= 0) return 0;
    return Math.max(0, roundCurrency(tendered - liveTotals.grandTotal));
  }, [cashTendered, liveTotals.grandTotal]);

  // Available free tables for transfer/merge target
  const freeTables = useMemo(() => {
    return tables.filter(
      (t) => t.status === 'free' && t.table_number !== activeBill?.table_number
    );
  }, [tables, activeBill]);

  const otherRunningBills = useMemo(() => {
    return tables
      .filter((t) => t.current_bill && t.current_bill.id !== activeBill?.id)
      .map((t) => t.current_bill!);
  }, [tables, activeBill]);

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] lg:h-[calc(100vh-2rem)] overflow-hidden bg-[#080706] text-[#F3EFEA] select-none font-sans">
      {/* ========================================================= */}
      {/* TOP HEADER CONTROLS BAR */}
      {/* ========================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#120E0B] border-b border-white/[0.08] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 p-1 rounded-xl bg-black/40 border border-white/10">
            {features?.running_table_bills !== false && (
              <button
                type="button"
                onClick={() => setActiveTab('tables')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'tables'
                    ? 'bg-[#D4AF37] text-black shadow-md'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-base">table_restaurant</span>
                <span>{t('staff.pos.floor_table_map', 'Floor & Table Map')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleStartCounterBill('takeaway')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'counter'
                  ? 'bg-[#D4AF37] text-black shadow-md'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">point_of_sale</span>
              <span>{t('staff.pos.counter_direct_bill', 'Counter Direct Bill')}</span>
            </button>
          </div>

          {activeBill && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs font-mono text-[#F3C766]">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>
                {activeBill.order_type === 'dine_in'
                  ? `TABLE ${activeBill.table_number}`
                  : activeBill.order_type.toUpperCase()}
              </span>
              <span className="text-stone-400">({activeBill.bill_number})</span>
            </div>
          )}
        </div>

        {/* Floor Quick Stats */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="hidden sm:flex items-center gap-1.5 text-stone-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>
              {tables.filter((t) => t.status === 'free').length} / {tables.length} Free Tables
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[#F3C766]">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>
              {currencySymbol}
              {tables.reduce((sum, t) => sum + t.running_total, 0) +
                counterBills.reduce((sum, b) => sum + b.grand_total, 0)}{' '}
              Live Floor Sales
            </span>
          </div>

          <button
            type="button"
            onClick={refreshFloorData}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 transition-colors"
            title="Refresh Floor"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MAIN BODY: 2 COLUMN SPLIT */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* ========================================================= */}
        {/* LEFT / CENTER VIEW: TABLE MAP OR MENU CATALOG */}
        {/* ========================================================= */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-white/[0.08] bg-[#0A0807]">
          {activeTab === 'tables' && !activeBill ? (
            /* ----------------------------------------------------- */
            /* TABLE FLOOR MAP VIEW */
            /* ----------------------------------------------------- */
            <div className="flex-1 flex flex-col p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#D4AF37]">grid_view</span>
                    Dining Floor Table Map
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Click any table to open running bill, view KOT batches, or take a new order.
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
                  {(['all', 'free', 'running', 'printed'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setTableFilter(st)}
                      className={`px-3 py-1 rounded-lg font-bold capitalize transition-all ${
                        tableFilter === st
                          ? 'bg-[#D4AF37] text-black shadow-sm'
                          : 'text-stone-400 hover:text-white'
                      }`}
                    >
                      {st === 'printed' ? 'Bill Printed' : st}
                    </button>
                  ))}
                </div>
              </div>

              {isLoadingTables ? (
                <div className="flex-1 flex items-center justify-center">
                  <span className="w-8 h-8 rounded-full border-2 border-[#D4AF37] border-t-transparent animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                  {tables
                    .filter((t) => tableFilter === 'all' || t.status === tableFilter)
                    .map((table) => {
                      const isFree = table.status === 'free';
                      const isRunning = table.status === 'running';
                      const isPrinted = table.status === 'printed';

                      const statusBadge = isFree
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : isPrinted
                        ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30';

                      return (
                        <div
                          key={table.id}
                          onClick={() => handleSelectTable(table)}
                          className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-36 ${
                            isFree
                              ? 'bg-[#120E0B]/70 border-white/10 hover:border-emerald-500/40 hover:bg-[#16120F]'
                              : isPrinted
                              ? 'bg-gradient-to-br from-[#12161f] to-[#0d1017] border-sky-500/40 shadow-lg'
                              : 'bg-gradient-to-br from-[#1b1510] to-[#120d09] border-amber-500/40 shadow-lg'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-black text-xl text-white">
                                {table.table_number}
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadge}`}
                              >
                                {table.status}
                              </span>
                            </div>
                            {table.label && (
                              <p className="text-[11px] text-stone-400 truncate mt-1">
                                {table.label}
                              </p>
                            )}
                          </div>

                          <div>
                            {isRunning || isPrinted ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between font-mono">
                                  <span className="text-xs text-stone-400">
                                    {table.item_count} items
                                  </span>
                                  <span className="text-sm font-black text-[#F3C766]">
                                    {currencySymbol}{table.running_total}
                                  </span>
                                </div>
                                <div className="text-[10px] text-stone-500 font-mono flex items-center justify-between">
                                  <span>{t('staff.pos.open_bill', 'Open Bill')}</span>
                                  <span className="text-amber-400">{t('staff.pos.tap_to_edit', 'Tap to edit')}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between text-xs text-stone-500">
                                <span>{table.capacity} Seats</span>
                                <span className="text-emerald-400 font-bold">{t('staff.pos.new_bill', '+ New Bill')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ) : (
            /* ----------------------------------------------------- */
            /* MENU CATALOG & ITEM PICKER (When bill is open or in counter mode) */
            /* ----------------------------------------------------- */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Back to Floor Map Button if Dine-In */}
              {activeTab === 'tables' && (
                <div className="px-4 py-2 bg-[#120E0B] border-b border-white/[0.08] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveBill(null);
                      setSelectedTable(null);
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-stone-300 hover:text-white"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    <span>{t('staff.pos.floor_table_map', 'Floor Table Map')}</span>
                  </button>

                  <div className="text-xs font-mono text-[#D4AF37]">
                    Active: {orderType === 'dine_in' ? `Table ${selectedTable?.table_number || activeBill?.table_number}` : orderType.toUpperCase()}
                  </div>
                </div>
              )}

              {/* Search & Category Tabs */}
              <div className="p-3 bg-[#0F0C0A] border-b border-white/[0.08] space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-stone-400 text-lg">
                      search
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('staff.pos.search_menu_items_wood_fired_p', 'Search menu items, wood-fired pizza, coffee...')}
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#D4AF37]"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-2.5 text-stone-400 hover:text-white"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                      selectedCategory === 'all'
                        ? 'bg-[#D4AF37] text-black shadow-sm'
                        : 'bg-white/5 text-stone-300 hover:bg-white/10'
                    }`}
                  >
                    All Items
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCategory(c.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                        selectedCategory === c.id
                          ? 'bg-[#D4AF37] text-black shadow-sm'
                          : 'bg-white/5 text-stone-300 hover:bg-white/10'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Grid */}
              <div className="flex-1 p-3 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {filteredMenuItems.map((item) => {
                    const isVeg = item.diet === 'veg' || item.diet === 'vegan';
                    return (
                      <div
                        key={item.id}
                        className="group relative p-2.5 rounded-xl bg-[#14100D] border border-white/[0.08] hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-2.5 h-2.5 rounded-full border shrink-0 ${
                                isVeg
                                  ? 'border-emerald-500 bg-emerald-500/20'
                                  : 'border-red-500 bg-red-500/20'
                              }`}
                              title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                            />
                            <p className="text-xs font-bold text-white line-clamp-2 leading-tight">
                              {item.name}
                            </p>
                          </div>
                        </div>

                        {item.description && (
                          <p className="text-[11px] text-stone-400 line-clamp-1 mb-2">
                            {item.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-white/5">
                          <span className="font-mono font-black text-xs text-[#F3C766]">
                            {currencySymbol}{item.price}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenCustomizer(item)}
                              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-stone-300 transition-colors"
                              title="Customize modifiers & notes"
                            >
                              <span className="material-symbols-outlined text-sm">tune</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickAddItem(item)}
                              className="px-2.5 py-1 rounded-lg bg-[#D4AF37] hover:bg-[#c29f2f] text-black font-bold text-xs transition-colors flex items-center gap-0.5"
                            >
                              <span className="material-symbols-outlined text-xs">add</span>
                              <span>{t('staff.pos.add', 'Add')}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT PANE: ACTIVE BILL / CART / KOT HISTORY */}
        {/* ========================================================= */}
        <div className="w-full lg:w-96 xl:w-[420px] flex flex-col bg-[#110E0C] shrink-0 border-t lg:border-t-0 border-white/[0.08]">
          {/* Bill Header & Order Type Switcher */}
          <div className="p-3 bg-[#16120E] border-b border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">
                  {orderType === 'dine_in'
                    ? `Table ${activeBill?.table_number || selectedTable?.table_number || 'Select'}`
                    : `${orderType.toUpperCase()} BILL`}
                </h3>
                <p className="text-[11px] font-mono text-stone-400">
                  {activeBill?.bill_number || 'New Bill Draft'}
                </p>
              </div>

              {/* Order Type Toggle */}
              <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10 text-[10px]">
                {(['dine_in', 'takeaway', 'delivery'] as const).map((ot) => (
                  <button
                    key={ot}
                    type="button"
                    onClick={() => setOrderType(ot)}
                    className={`px-2 py-1 rounded font-bold capitalize transition-all ${
                      orderType === ot
                        ? 'bg-[#D4AF37] text-black shadow-sm'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    {ot === 'dine_in' ? 'Dine-In' : ot}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Details Accordion/Inputs for Takeaway & Delivery */}
            {(orderType === 'takeaway' || orderType === 'delivery') && (
              <div className="space-y-1.5 pt-1 border-t border-white/5">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={t('staff.pos.guest_name_optional', 'Guest Name (optional)')}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#D4AF37]"
                  />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder={t('staff.pos.phone', 'Phone')}
                    className="w-32 px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                {orderType === 'delivery' && (
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder={t('staff.pos.full_delivery_address', 'Full Delivery Address')}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#D4AF37]"
                  />
                )}
              </div>
            )}
          </div>

          {/* Items Container: Previously Fired KOTs + Draft Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* 1. PREVIOUSLY FIRED KOT ITEMS (Read-only on kitchen side, voidable with reason) */}
            {activeBill?.items && activeBill.items.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-400 border-b border-white/5 pb-1">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
                    <span>Kitchen Orders ({activeBill.items.filter((i) => !i.is_voided).length})</span>
                  </span>
                  <span className="text-[10px] text-stone-500 uppercase tracking-wider">{t('staff.pos.fired_batches', 'Fired Batches')}</span>
                </div>

                <div className="space-y-1.5">
                  {activeBill.items.map((it) => (
                    <div
                      key={it.id}
                      className={`p-2 rounded-xl border text-xs transition-colors ${
                        it.is_voided
                          ? 'bg-red-950/20 border-red-500/20 opacity-50 line-through'
                          : 'bg-[#181310] border-white/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <span className="font-mono font-bold text-[#F3C766] min-w-[20px]">
                            {it.quantity}×
                          </span>
                          <div>
                            <span className="font-semibold text-white">{it.item_name}</span>
                            {it.modifiers && it.modifiers.length > 0 && (
                              <p className="text-[10px] text-stone-400">
                                + {it.modifiers.map((m) => m.name).join(', ')}
                              </p>
                            )}
                            {it.notes && (
                              <p className="text-[10px] text-amber-300 italic">"{it.notes}"</p>
                            )}
                            {it.is_voided && (
                              <p className="text-[10px] text-red-400 not-italic">
                                Voided: {it.void_reason} ({it.void_approved_by})
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-stone-300">{currencySymbol}{it.line_total}</span>
                          {!it.is_voided && (
                            <button
                              type="button"
                              onClick={() => {
                                setVoidingItem(it);
                                setVoidReason('Guest changed mind');
                                setVoidManagerPin('');
                              }}
                              className="p-1 rounded hover:bg-red-500/20 text-stone-400 hover:text-red-400"
                              title="Void item"
                            >
                              <span className="material-symbols-outlined text-sm">cancel</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. DRAFT ITEMS TO BE SENT TO KITCHEN */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#D4AF37] border-b border-white/5 pb-1">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                  <span>New Items To Fire ({liveTotals.draftCount})</span>
                </span>
                {draftItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraftItems([])}
                    className="text-[10px] text-red-400 hover:underline"
                  >
                    Clear Draft
                  </button>
                )}
              </div>

              {draftItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-500 italic">
                  Select items from the catalog to add to this KOT ticket.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {draftItems.map((it, idx) => (
                    <div
                      key={`${it.id}-${idx}`}
                      className="p-2 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-semibold text-white">{it.name}</div>
                          {it.modifiers.length > 0 && (
                            <div className="text-[10px] text-stone-400">
                              + {it.modifiers.map((m) => m.name).join(', ')}
                            </div>
                          )}
                          {it.notes && (
                            <div className="text-[10px] text-amber-300 italic">"{it.notes}"</div>
                          )}
                          <div className="font-mono text-xs text-[#F3C766] mt-0.5">
                            {currencySymbol}
                            {(
                              (it.price + it.modifiers.reduce((s, m) => s + m.price, 0)) *
                              it.quantity
                            ).toFixed(2)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center bg-black/40 border border-white/10 rounded-lg">
                            <button
                              type="button"
                              onClick={() => handleUpdateDraftQuantity(idx, -1)}
                              className="px-2 py-0.5 text-stone-400 hover:text-white"
                            >
                              -
                            </button>
                            <span className="px-1.5 font-mono font-bold text-xs text-white">
                              {it.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateDraftQuantity(idx, 1)}
                              className="px-2 py-0.5 text-stone-400 hover:text-white"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDraftItem(idx)}
                            className="p-1 text-stone-500 hover:text-red-400"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* KOT Instructions */}
                  <input
                    type="text"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder={t('staff.pos.kot_special_note_e_g_serve_dri', 'KOT Special Note (e.g. serve drinks first)')}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#D4AF37]"
                  />

                  {/* Action Button: Punch KOT to Kitchen */}
                  <button
                    type="button"
                    disabled={isPunchingKOT}
                    onClick={handlePunchKOT}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-[#D4AF37] hover:from-amber-500 hover:to-[#e0bb42] text-black font-bold text-xs tracking-wide uppercase transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isPunchingKOT ? (
                      <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base">soup_kitchen</span>
                        <span>{t('staff.pos.send_kot_to_kitchen', 'Send KOT to Kitchen')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* FINANCIAL SUMMARY & DISCOUNT ENGINE */}
          {/* ========================================================= */}
          <div className="p-3 bg-[#0F0C0A] border-t border-white/[0.08] space-y-2">
            {/* Discounts Section */}
            {features?.discounts !== false && (
              <div className="flex items-center gap-1.5">
                {appliedDiscount ? (
                  <div className="flex-1 flex items-center justify-between px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 font-mono">
                    <span>
                      Discount: -{currencySymbol}{liveTotals.discountAmount} (
                      {appliedDiscount.code || 'Manual Approval'})
                    </span>
                    <button
                      type="button"
                      onClick={() => setAppliedDiscount(null)}
                      className="text-stone-400 hover:text-white ml-2"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={discountCodeInput}
                      onChange={(e) => setDiscountCodeInput(e.target.value)}
                      placeholder={t('staff.pos.coupon_code', 'Coupon code')}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white uppercase placeholder-stone-500 focus:outline-none focus:border-[#D4AF37]"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromoCode}
                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsManualDiscountModalOpen(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/30 hover:bg-[#D4AF37]/30 text-xs font-bold text-[#F3C766] transition-colors"
                      title="Manager Manual Discount"
                    >
                      Manager %
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Live Financial Breakdown */}
            <div className="space-y-1 text-xs font-mono pt-1 border-t border-white/5">
              <div className="flex justify-between text-stone-400">
                <span>{t('staff.pos.subtotal', 'Subtotal')}</span>
                <span>{currencySymbol}{liveTotals.subtotal}</span>
              </div>

              {liveTotals.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>{t('staff.pos.discount', 'Discount')}</span>
                  <span>-{currencySymbol}{liveTotals.discountAmount}</span>
                </div>
              )}

              {/* Tax engine lines */}
              {liveTotals.taxBreakdownLines.map((line, idx) => (
                <div key={idx} className="flex justify-between text-stone-400">
                  <span>
                    {line.label} ({(line.rate * 100).toFixed(1)}% {line.mode})
                  </span>
                  <span>{currencySymbol}{line.amount}</span>
                </div>
              ))}

              <div className="flex justify-between text-sm font-black text-white pt-1.5 border-t border-white/10">
                <span>{t('staff.pos.grand_total', 'Grand Total')}</span>
                <span className="text-[#F3C766] text-base">{currencySymbol}{liveTotals.grandTotal}</span>
              </div>
            </div>

            {/* Bill Actions / Settle */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={!activeBill || liveTotals.subtotal === 0}
                onClick={handlePrintCustomerBill}
                className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-stone-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">print</span>
                <span>{t('staff.pos.print_bill', 'Print Bill')}</span>
              </button>

              <button
                type="button"
                disabled={!activeBill || liveTotals.subtotal === 0}
                onClick={() => setIsSettleModalOpen(true)}
                className="py-2.5 px-3 rounded-xl bg-[#D4AF37] hover:bg-[#c29f2f] text-black font-black text-xs transition-colors shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">payments</span>
                <span>{t('staff.pos.settle_pay', 'Settle & Pay')}</span>
              </button>
            </div>

            {/* Table Operations Menu (Transfer, Merge, Move Items) */}
            {activeBill && activeBill.order_type === 'dine_in' && (
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(true)}
                  className="flex-1 py-1 px-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 font-semibold text-center transition-colors"
                >
                  Transfer Table
                </button>
                <button
                  type="button"
                  onClick={() => setIsMergeModalOpen(true)}
                  className="flex-1 py-1 px-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 font-semibold text-center transition-colors"
                >
                  Merge Table
                </button>
                <button
                  type="button"
                  onClick={() => setIsMoveItemsModalOpen(true)}
                  className="flex-1 py-1 px-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 font-semibold text-center transition-colors"
                >
                  Move Items
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: ITEM CUSTOMIZER (Modifiers & Notes) */}
      {/* ========================================================= */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#16120E] border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{customizingItem.name}</h3>
                <p className="text-xs text-[#F3C766] font-mono mt-0.5">
                  Base Price: {currencySymbol}{customizingItem.price}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingItem(null)}
                className="text-stone-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5">
              <span className="text-xs font-semibold text-stone-300">{t('staff.pos.quantity', 'Quantity')}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCustomizerQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold flex items-center justify-center"
                >
                  -
                </button>
                <span className="font-mono font-bold text-sm text-white w-6 text-center">
                  {customizerQuantity}
                </span>
                <button
                  type="button"
                  onClick={() => setCustomizerQuantity((q) => q + 1)}
                  className="w-8 h-8 rounded-lg bg-white/10 text-white font-bold flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>

            {/* Modifiers List */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-400">{t('staff.pos.available_modifiers', 'Available Modifiers')}</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {DEFAULT_MODIFIERS.map((mod) => {
                  const isChecked = customizerModifiers.some((m) => m.id === mod.id);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => handleToggleModifier(mod)}
                      className={`p-2 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                        isChecked
                          ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-white'
                          : 'bg-black/30 border-white/5 text-stone-300 hover:bg-white/5'
                      }`}
                    >
                      <span>{mod.name}</span>
                      <span className="font-mono text-[10px] text-[#F3C766]">
                        {mod.price > 0 ? `+${currencySymbol}${mod.price}` : 'Free'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cooking Notes */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-400">{t('staff.pos.kitchen_note', 'Kitchen Note')}</label>
              <input
                type="text"
                value={customizerNotes}
                onChange={(e) => setCustomizerNotes(e.target.value)}
                placeholder={t('staff.pos.e_g_less_spicy_crisp_base_extr', 'e.g. less spicy, crisp base, extra hot...')}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <button
              type="button"
              onClick={handleConfirmCustomizer}
              className="w-full py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c29f2f] text-black font-black text-xs uppercase tracking-wide transition-all shadow-lg"
            >
              Add To Ticket
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: VOID ITEM (Reason Required + Manager PIN) */}
      {/* ========================================================= */}
      {voidingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#16120E] border border-red-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <span className="material-symbols-outlined text-2xl">warning</span>
              <h3 className="text-base font-bold text-white">{t('staff.pos.void_item_authorization', 'Void Item Authorization')}</h3>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs">
              <div className="font-bold text-white">{voidingItem.item_name}</div>
              <div className="flex justify-between text-stone-400 mt-1 font-mono">
                <span>Quantity: {voidingItem.quantity}</span>
                <span>Amount: {currencySymbol}{voidingItem.line_total}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-300">{t('staff.pos.void_reason_required', 'Void Reason (Required)')}</label>
              <select
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="Guest changed mind">{t('staff.pos.guest_changed_mind', 'Guest changed mind')}</option>
                <option value="Kitchen out of ingredients">{t('staff.pos.kitchen_out_of_ingredients', 'Kitchen out of ingredients')}</option>
                <option value="Wrong item keyed by cashier">{t('staff.pos.wrong_item_keyed_by_cashier', 'Wrong item keyed by cashier')}</option>
                <option value="Quality complaint / replacement">{t('staff.pos.quality_complaint_replacement', 'Quality complaint / replacement')}</option>
                <option value="Other">{t('staff.pos.other_custom_text', 'Other (Custom text)')}</option>
              </select>

              {voidReason === 'Other' && (
                <input
                  type="text"
                  value={voidCustomReason}
                  onChange={(e) => setVoidCustomReason(e.target.value)}
                  placeholder={t('staff.pos.specify_custom_reason', 'Specify custom reason...')}
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                />
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-300">
                Manager PIN (Default: 1234)
              </label>
              <input
                type="password"
                maxLength={8}
                value={voidManagerPin}
                onChange={(e) => setVoidManagerPin(e.target.value)}
                placeholder={t('staff.pos.enter_4_digit_pin', 'Enter 4-digit PIN')}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-sm font-mono text-center text-white tracking-widest focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVoidingItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-stone-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingVoid}
                onClick={handleConfirmVoid}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-lg disabled:opacity-50"
              >
                {isSubmittingVoid ? 'Auditing...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: MANAGER MANUAL DISCOUNT */}
      {/* ========================================================= */}
      {isManualDiscountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#16120E] border border-[#D4AF37]/40 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[#D4AF37]">percent</span>
              Manager Manual Discount
            </h3>

            <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/10 text-xs font-bold">
              <button
                type="button"
                onClick={() => setManualDiscountType('percentage')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  manualDiscountType === 'percentage'
                    ? 'bg-[#D4AF37] text-black shadow-sm'
                    : 'text-stone-400'
                }`}
              >
                Percentage (%)
              </button>
              <button
                type="button"
                onClick={() => setManualDiscountType('flat')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  manualDiscountType === 'flat'
                    ? 'bg-[#D4AF37] text-black shadow-sm'
                    : 'text-stone-400'
                }`}
              >
                Flat Amount ({currencySymbol})
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-300">
                Discount Value ({manualDiscountType === 'percentage' ? '%' : currencySymbol})
              </label>
              <input
                type="number"
                min={1}
                max={manualDiscountType === 'percentage' ? 100 : liveTotals.subtotal}
                value={manualDiscountValue}
                onChange={(e) => setManualDiscountValue(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-sm font-mono text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-300">{t('staff.pos.reason_memo', 'Reason / Memo')}</label>
              <input
                type="text"
                value={manualDiscountReason}
                onChange={(e) => setManualDiscountReason(e.target.value)}
                placeholder={t('staff.pos.e_g_vip_guest_service_delay_ow', 'e.g. VIP guest, service delay, owner friend')}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-300">
                Manager PIN (Default: 1234)
              </label>
              <input
                type="password"
                maxLength={8}
                value={manualDiscountPin}
                onChange={(e) => setManualDiscountPin(e.target.value)}
                placeholder={t('staff.pos.enter_4_digit_pin', 'Enter 4-digit PIN')}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-sm font-mono text-center text-white tracking-widest focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsManualDiscountModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-stone-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyManualDiscount}
                className="flex-1 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c29f2f] text-xs font-bold text-black shadow-lg"
              >
                Authorize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: TRANSFER TABLE */}
      {/* ========================================================= */}
      {isTransferModalOpen && activeBill && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#16120E] border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[#D4AF37]">swap_horiz</span>
              Transfer Table {activeBill.table_number}
            </h3>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-300">{t('staff.pos.select_free_destination_table', 'Select Free Destination Table')}</label>
              {freeTables.length === 0 ? (
                <div className="p-3 rounded-xl bg-red-950/20 text-red-300 text-xs">
                  No free tables available right now.
                </div>
              ) : (
                <select
                  value={transferTargetTable}
                  onChange={(e) => setTransferTargetTable(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="">{t('staff.pos.choose_destination_table', '-- Choose destination table --')}</option>
                  {freeTables.map((t) => (
                    <option key={t.id} value={t.table_number}>
                      Table {t.table_number} ({t.capacity} seats{t.label ? ` - ${t.label}` : ''})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-xs font-bold text-stone-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!transferTargetTable}
                onClick={handleConfirmTransfer}
                className="flex-1 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c29f2f] text-xs font-bold text-black shadow-lg disabled:opacity-50"
              >
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: MERGE TABLES */}
      {/* ========================================================= */}
      {isMergeModalOpen && activeBill && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#16120E] border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[#D4AF37]">call_merge</span>
              Merge Table {activeBill.table_number}
            </h3>

            <p className="text-xs text-stone-400">
              All items from Table {activeBill.table_number} will be merged into the target table, and Table {activeBill.table_number} will be freed.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-300">{t('staff.pos.select_target_table', 'Select Target Table')}</label>
              {otherRunningBills.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-950/20 text-amber-300 text-xs">
                  No other active tables to merge into.
                </div>
              ) : (
                <select
                  value={mergeTargetBillId}
                  onChange={(e) => setMergeTargetBillId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="">{t('staff.pos.choose_active_table', '-- Choose active table --')}</option>
                  {otherRunningBills.map((b) => (
                    <option key={b.id} value={b.id}>
                      Table {b.table_number} (Current Total: {currencySymbol}{b.grand_total})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-xs font-bold text-stone-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!mergeTargetBillId}
                onClick={handleConfirmMerge}
                className="flex-1 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c29f2f] text-xs font-bold text-black shadow-lg disabled:opacity-50"
              >
                Merge Tables
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: MOVE SPECIFIC ITEMS */}
      {/* ========================================================= */}
      {isMoveItemsModalOpen && activeBill && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#16120E] border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[#D4AF37]">move_down</span>
              Move Items from Table {activeBill.table_number}
            </h3>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-300">{t('staff.pos.select_destination_table_bill', 'Select Destination Table Bill')}</label>
              <select
                value={moveTargetBillId}
                onChange={(e) => setMoveTargetBillId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="">{t('staff.pos.choose_target_bill', '-- Choose target bill --')}</option>
                {otherRunningBills.map((b) => (
                  <option key={b.id} value={b.id}>
                    Table {b.table_number} ({currencySymbol}{b.grand_total})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-300">{t('staff.pos.select_items_to_move', 'Select Items to Move')}</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {(activeBill.items || [])
                  .filter((it) => !it.is_voided)
                  .map((it) => {
                    const isSelected = moveSelectedItems.includes(it.id);
                    return (
                      <div
                        key={it.id}
                        onClick={() =>
                          setMoveSelectedItems((prev) =>
                            isSelected ? prev.filter((id) => id !== it.id) : [...prev, it.id]
                          )
                        }
                        className={`p-2 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-white'
                            : 'bg-black/30 border-white/5 text-stone-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={isSelected} readOnly />
                          <span>
                            {it.quantity}× {it.item_name}
                          </span>
                        </div>
                        <span className="font-mono text-[#F3C766]">{currencySymbol}{it.line_total}</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsMoveItemsModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-xs font-bold text-stone-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!moveTargetBillId || moveSelectedItems.length === 0}
                onClick={handleConfirmMoveItems}
                className="flex-1 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#c29f2f] text-xs font-bold text-black shadow-lg disabled:opacity-50"
              >
                Move Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 7: SETTLE & PAYMENT MODAL */}
      {/* ========================================================= */}
      {isSettleModalOpen && activeBill && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#16120E] border border-[#D4AF37]/40 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#D4AF37]">receipt_long</span>
                  Bill Settlement
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  {activeBill.order_type === 'dine_in'
                    ? `Table ${activeBill.table_number}`
                    : activeBill.order_type.toUpperCase()}{' '}
                  • {activeBill.bill_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettleModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Total Due Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 to-black/60 border border-[#D4AF37]/30 text-center">
              <span className="text-xs uppercase tracking-wider text-stone-400 font-bold">
                Total Amount Due
              </span>
              <div className="text-3xl font-black text-[#F3C766] font-mono mt-1">
                {currencySymbol}{liveTotals.grandTotal}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-300">{t('staff.pos.payment_tender', 'Payment Tender')}</label>
              <div className="grid grid-cols-4 gap-2">
                {(['cash', 'upi', 'card', 'split'] as const)
                  .filter((m) => m !== 'split' || features?.split_bills !== false)
                  .map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-1 rounded-xl border text-xs font-bold uppercase transition-all flex flex-col items-center gap-1 ${
                      paymentMethod === method
                        ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-md'
                        : 'bg-black/30 border-white/10 text-stone-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">
                      {method === 'cash'
                        ? 'payments'
                        : method === 'upi'
                        ? 'qr_code_2'
                        : method === 'card'
                        ? 'credit_card'
                        : 'call_split'}
                    </span>
                    <span>{method}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cash Tendered & Change Return Calculator */}
            {paymentMethod === 'cash' && (
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-300">{t('staff.pos.cash_received', 'Cash Received')}</label>
                  <div className="flex gap-1">
                    {[500, 1000, 2000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashTendered(String(amt))}
                        className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] font-mono text-stone-300"
                      >
                        {currencySymbol}{amt}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCashTendered(String(liveTotals.grandTotal))}
                      className="px-2 py-0.5 rounded bg-amber-500/20 text-[10px] font-mono text-amber-300"
                    >
                      Exact
                    </button>
                  </div>
                </div>

                <input
                  type="number"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder={t('staff.pos.enter_cash_received', 'Enter cash received...')}
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-sm font-mono text-white focus:outline-none focus:border-[#D4AF37]"
                />

                {parseFloat(cashTendered) > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs font-mono">
                    <span className="text-stone-400">{t('staff.pos.change_to_return', 'Change To Return:')}</span>
                    <span className="text-base font-bold text-emerald-400">
                      {currencySymbol}{cashChangeDue}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              disabled={isSettling}
              onClick={handleConfirmSettleBill}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs uppercase tracking-wider transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSettling ? (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>{t('staff.pos.confirm_payment_print_receipt', 'Confirm Payment & Print Receipt')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
