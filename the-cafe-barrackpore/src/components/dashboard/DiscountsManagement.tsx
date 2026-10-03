import React, { useState, useEffect, useCallback } from 'react';
import { useNotification } from '../../hooks/useNotification';
import type { DiscountCode, HappyHourSchedule } from '../../types/owner';
import type { MenuCategory } from '../../types/menu';
import {
  fetchDiscountCodes,
  saveDiscountCode,
  deleteDiscountCode,
  fetchHappyHourSchedules,
  saveHappyHourSchedule,
  deleteHappyHourSchedule,
} from '../../services/ownerService';
import { fetchMenuCategories, MENU_CATEGORIES_FALLBACK } from '../../services/menuService';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DiscountsManagement: React.FC = () => {
  const { addNotification } = useNotification();
  
  const [activeTab, setActiveTab] = useState<'discount_codes' | 'happy_hours'>('discount_codes');
  const [isLoading, setIsLoading] = useState(true);
  
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [happyHours, setHappyHours] = useState<HappyHourSchedule[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>(MENU_CATEGORIES_FALLBACK);

  // Modals
  const [isDcModalOpen, setIsDcModalOpen] = useState(false);
  const [isHhModalOpen, setIsHhModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // DC Form
  const [dcFormId, setDcFormId] = useState('');
  const [dcFormCode, setDcFormCode] = useState('');
  const [dcFormDescription, setDcFormDescription] = useState('');
  const [dcFormType, setDcFormType] = useState<'percentage' | 'flat'>('percentage');
  const [dcFormValue, setDcFormValue] = useState(10);
  const [dcFormMinOrder, setDcFormMinOrder] = useState(0);
  const [dcFormMaxDiscount, setDcFormMaxDiscount] = useState<number | ''>('');
  const [dcFormMaxUses, setDcFormMaxUses] = useState<number | ''>('');
  const [dcFormValidFrom, setDcFormValidFrom] = useState('');
  const [dcFormValidUntil, setDcFormValidUntil] = useState('');
  const [dcFormActive, setDcFormActive] = useState(true);

  // HH Form
  const [hhFormId, setHhFormId] = useState('');
  const [hhFormLabel, setHhFormLabel] = useState('');
  const [hhFormDay, setHhFormDay] = useState(0);
  const [hhFormStart, setHhFormStart] = useState('15:00');
  const [hhFormEnd, setHhFormEnd] = useState('17:00');
  const [hhFormDiscount, setHhFormDiscount] = useState(10);
  const [hhFormCategory, setHhFormCategory] = useState('');
  const [hhFormActive, setHhFormActive] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [codes, hhs, cats] = await Promise.all([
        fetchDiscountCodes(),
        fetchHappyHourSchedules(),
        fetchMenuCategories()
      ]);
      setDiscountCodes(codes);
      setHappyHours(hhs);
      setCategories(cats.length > 0 ? cats : MENU_CATEGORIES_FALLBACK);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // =============== DISCOUNT CODES ===============

  const handleOpenDcAdd = () => {
    setDcFormId('');
    setDcFormCode('');
    setDcFormDescription('');
    setDcFormType('percentage');
    setDcFormValue(10);
    setDcFormMinOrder(0);
    setDcFormMaxDiscount('');
    setDcFormMaxUses('');
    setDcFormValidFrom(new Date().toISOString().slice(0,10));
    setDcFormValidUntil('');
    setDcFormActive(true);
    setIsDcModalOpen(true);
  };

  const handleOpenDcEdit = (code: DiscountCode) => {
    setDcFormId(code.id);
    setDcFormCode(code.code);
    setDcFormDescription(code.description || '');
    setDcFormType(code.discount_type);
    setDcFormValue(code.discount_value);
    setDcFormMinOrder(code.min_order_amount);
    setDcFormMaxDiscount(code.max_discount_amount || '');
    setDcFormMaxUses(code.max_uses || '');
    setDcFormValidFrom(code.valid_from ? new Date(code.valid_from).toISOString().slice(0,10) : '');
    setDcFormValidUntil(code.valid_until ? new Date(code.valid_until).toISOString().slice(0,10) : '');
    setDcFormActive(code.active);
    setIsDcModalOpen(true);
  };

  const handleSaveDc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dcFormCode.trim()) return;
    setIsSaving(true);
    
    const payload: Partial<DiscountCode> = {
      id: dcFormId || undefined,
      code: dcFormCode.trim().toUpperCase(),
      description: dcFormDescription.trim() || undefined,
      discount_type: dcFormType,
      discount_value: dcFormValue,
      min_order_amount: dcFormMinOrder,
      max_discount_amount: dcFormMaxDiscount === '' ? null : Number(dcFormMaxDiscount),
      max_uses: dcFormMaxUses === '' ? null : Number(dcFormMaxUses),
      valid_from: dcFormValidFrom ? new Date(dcFormValidFrom).toISOString() : new Date().toISOString(),
      valid_until: dcFormValidUntil ? new Date(dcFormValidUntil).toISOString() : undefined,
      active: dcFormActive,
    };

    const res = await saveDiscountCode(payload);
    setIsSaving(false);
    if (res.success) {
      addNotification('success', 'Discount Code Saved', `${payload.code} has been updated.`);
      setIsDcModalOpen(false);
      loadData();
    } else {
      addNotification('error', 'Save Failed', res.error || 'Could not save discount code.');
    }
  };

  const handleDeleteDc = async (id: string, code: string) => {
    if (!window.confirm(`Delete discount code ${code}?`)) return;
    const res = await deleteDiscountCode(id);
    if (res.success) {
      addNotification('info', 'Code Deleted', `${code} was deleted.`);
      loadData();
    } else {
      addNotification('error', 'Delete Failed', res.error || 'Could not delete discount code.');
    }
  };

  // =============== HAPPY HOURS ===============

  const handleOpenHhAdd = () => {
    setHhFormId('');
    setHhFormLabel('');
    setHhFormDay(0);
    setHhFormStart('15:00');
    setHhFormEnd('17:00');
    setHhFormDiscount(10);
    setHhFormCategory('');
    setHhFormActive(true);
    setIsHhModalOpen(true);
  };

  const handleOpenHhEdit = (hh: HappyHourSchedule) => {
    setHhFormId(hh.id);
    setHhFormLabel(hh.label);
    setHhFormDay(hh.day_of_week);
    setHhFormStart(hh.start_time);
    setHhFormEnd(hh.end_time);
    setHhFormDiscount(hh.discount_percentage);
    setHhFormCategory(hh.category_id || '');
    setHhFormActive(hh.active);
    setIsHhModalOpen(true);
  };

  const handleSaveHh = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hhFormLabel.trim()) return;
    setIsSaving(true);
    
    const payload: Partial<HappyHourSchedule> = {
      id: hhFormId || undefined,
      label: hhFormLabel.trim(),
      day_of_week: hhFormDay,
      start_time: hhFormStart,
      end_time: hhFormEnd,
      discount_percentage: hhFormDiscount,
      category_id: hhFormCategory || null,
      active: hhFormActive,
    };

    const res = await saveHappyHourSchedule(payload);
    setIsSaving(false);
    if (res.success) {
      addNotification('success', 'Happy Hour Saved', `${payload.label} has been updated.`);
      setIsHhModalOpen(false);
      loadData();
    } else {
      addNotification('error', 'Save Failed', res.error || 'Could not save happy hour.');
    }
  };

  const handleDeleteHh = async (id: string, label: string) => {
    if (!window.confirm(`Delete happy hour schedule ${label}?`)) return;
    const res = await deleteHappyHourSchedule(id);
    if (res.success) {
      addNotification('info', 'Schedule Deleted', `${label} was deleted.`);
      loadData();
    } else {
      addNotification('error', 'Delete Failed', res.error || 'Could not delete happy hour.');
    }
  };

  const renderDcStatus = (code: DiscountCode) => {
    if (!code.active) return <span className="text-zinc-500 font-medium">Inactive</span>;
    if (code.valid_until && new Date(code.valid_until) < new Date()) {
      return <span className="text-red-400 font-medium">Expired</span>;
    }
    if (code.max_uses && code.used_count >= code.max_uses) {
      return <span className="text-rose-400 font-medium">Exhausted</span>;
    }
    if (code.max_uses && code.used_count >= code.max_uses * 0.8) {
      return <span className="text-amber-400 font-medium">Approaching Limit</span>;
    }
    return <span className="text-emerald-400 font-medium">Active</span>;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* COCKPIT HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
              Promotion Engine
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-black text-white mt-1 tracking-tight">
            Discounts & Happy Hours
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
            Manage promotional discount codes and automate weekly happy hour schedules.
          </p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-4">
        <button
          onClick={() => setActiveTab('discount_codes')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === 'discount_codes'
              ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30'
              : 'text-zinc-500 hover:text-white hover:bg-white/[0.04] border border-transparent'
          }`}
        >
          Discount Codes
        </button>
        <button
          onClick={() => setActiveTab('happy_hours')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === 'happy_hours'
              ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30'
              : 'text-zinc-500 hover:text-white hover:bg-white/[0.04] border border-transparent'
          }`}
        >
          Happy Hours
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : activeTab === 'discount_codes' ? (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={handleOpenDcAdd}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F3C766] to-[#D4AF37] text-[#070605] text-xs font-black tracking-wider uppercase flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Create Code
            </button>
          </div>

          <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
            <div className="rounded-[calc(1rem-0.125rem)] bg-[#120F0D] overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="text-xs uppercase bg-black/40 text-zinc-500 font-mono tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Min Order</th>
                    <th className="px-4 py-3">Uses</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {discountCodes.map((code) => (
                    <tr key={code.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-white">{code.code}</td>
                      <td className="px-4 py-3 capitalize">{code.discount_type}</td>
                      <td className="px-4 py-3">
                        {code.discount_type === 'percentage' ? `${code.discount_value}%` : `₹${code.discount_value}`}
                      </td>
                      <td className="px-4 py-3">₹{code.min_order_amount}</td>
                      <td className="px-4 py-3">
                        {code.used_count} {code.max_uses ? `/ ${code.max_uses}` : ''}
                      </td>
                      <td className="px-4 py-3 text-xs">{renderDcStatus(code)}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => handleOpenDcEdit(code)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteDc(code.id, code.code)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {discountCodes.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                        No discount codes found. Create one to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={handleOpenHhAdd}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F3C766] to-[#D4AF37] text-[#070605] text-xs font-black tracking-wider uppercase flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Add Schedule
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {happyHours.map((hh) => {
              const catName = categories.find(c => c.id === hh.category_id)?.name || 'All Categories';
              return (
                <div key={hh.id} className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
                  <div className="p-4 rounded-[calc(1rem-0.125rem)] bg-[#120F0D] flex flex-col h-full relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-white text-sm">{hh.label}</h3>
                        <p className="text-xs text-[#D4AF37] font-mono mt-1">
                          {DAYS_OF_WEEK[hh.day_of_week]} • {hh.start_time} - {hh.end_time}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenHhEdit(hh)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteHh(hh.id, hh.label)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-auto space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Discount:</span>
                        <span className="text-white font-bold">{hh.discount_percentage}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Applies to:</span>
                        <span className="text-white truncate max-w-[120px]">{catName}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Status:</span>
                        <span className={hh.active ? "text-emerald-400" : "text-zinc-500"}>
                          {hh.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {happyHours.length === 0 && (
              <div className="col-span-full py-10 text-center text-zinc-500 p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
                <div className="p-4 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
                  No happy hour schedules found. Create one to automatically apply discounts during specific times.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DISCOUNT CODE MODAL */}
      {isDcModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg p-1 rounded-2xl bg-gradient-to-b from-[#D4AF37]/40 to-[#120F0D] border border-[#D4AF37]/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#120F0D] rounded-[calc(1rem-0.125rem)] p-6 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif font-black text-white">
                  {dcFormId ? 'Edit Discount Code' : 'Create Discount Code'}
                </h3>
                <button onClick={() => setIsDcModalOpen(false)} className="text-zinc-400 hover:text-white">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveDc} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Code</label>
                  <input
                    required
                    type="text"
                    value={dcFormCode}
                    onChange={(e) => setDcFormCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none uppercase font-mono"
                    placeholder="e.g. SUMMER20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    value={dcFormDescription}
                    onChange={(e) => setDcFormDescription(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                    placeholder="Summer special promotion"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Discount Type</label>
                    <select
                      value={dcFormType}
                      onChange={(e) => setDcFormType(e.target.value as 'percentage' | 'flat')}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="flat">Flat Amount (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Value</label>
                    <input
                      required
                      type="number"
                      min="0"
                      step={dcFormType === 'percentage' ? "1" : "10"}
                      value={dcFormValue}
                      onChange={(e) => setDcFormValue(Number(e.target.value))}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Min Order (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={dcFormMinOrder}
                      onChange={(e) => setDcFormMinOrder(Number(e.target.value))}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Max Uses (Optional)</label>
                    <input
                      type="number"
                      min="1"
                      value={dcFormMaxUses}
                      onChange={(e) => setDcFormMaxUses(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                      placeholder="Unlimited"
                    />
                  </div>
                </div>

                {dcFormType === 'percentage' && (
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Max Discount Amount (₹, Optional)</label>
                    <input
                      type="number"
                      min="1"
                      value={dcFormMaxDiscount}
                      onChange={(e) => setDcFormMaxDiscount(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                      placeholder="No limit"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Valid From</label>
                    <input
                      type="date"
                      value={dcFormValidFrom}
                      onChange={(e) => setDcFormValidFrom(e.target.value)}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Valid Until (Optional)</label>
                    <input
                      type="date"
                      value={dcFormValidUntil}
                      onChange={(e) => setDcFormValidUntil(e.target.value)}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 py-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dcFormActive}
                      onChange={(e) => setDcFormActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-white/[0.1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D4AF37]"></div>
                  </label>
                  <span className="text-sm font-medium text-white">Active</span>
                </div>

                <div className="pt-4 border-t border-white/[0.06] flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsDcModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-lg bg-[#D4AF37] text-black text-sm font-bold shadow-[0_4px_15px_rgba(212,175,55,0.2)] hover:bg-[#F3C766] disabled:opacity-50 transition-colors"
                  >
                    {isSaving ? 'Saving...' : 'Save Code'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* HAPPY HOUR MODAL */}
      {isHhModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md p-1 rounded-2xl bg-gradient-to-b from-[#D4AF37]/40 to-[#120F0D] border border-[#D4AF37]/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#120F0D] rounded-[calc(1rem-0.125rem)] p-6 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif font-black text-white">
                  {hhFormId ? 'Edit Happy Hour' : 'Add Happy Hour'}
                </h3>
                <button onClick={() => setIsHhModalOpen(false)} className="text-zinc-400 hover:text-white">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveHh} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Label</label>
                  <input
                    required
                    type="text"
                    value={hhFormLabel}
                    onChange={(e) => setHhFormLabel(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                    placeholder="e.g. Afternoon Tea"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Day of Week</label>
                  <select
                    value={hhFormDay}
                    onChange={(e) => setHhFormDay(Number(e.target.value))}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                  >
                    {DAYS_OF_WEEK.map((day, idx) => (
                      <option key={idx} value={idx}>{day}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Start Time</label>
                    <input
                      required
                      type="time"
                      value={hhFormStart}
                      onChange={(e) => setHhFormStart(e.target.value)}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">End Time</label>
                    <input
                      required
                      type="time"
                      value={hhFormEnd}
                      onChange={(e) => setHhFormEnd(e.target.value)}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Discount Percentage (%)</label>
                  <input
                    required
                    type="number"
                    min="1"
                    max="100"
                    value={hhFormDiscount}
                    onChange={(e) => setHhFormDiscount(Number(e.target.value))}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Category Filter (Optional)</label>
                  <select
                    value={hhFormCategory}
                    onChange={(e) => setHhFormCategory(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 py-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hhFormActive}
                      onChange={(e) => setHhFormActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-white/[0.1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D4AF37]"></div>
                  </label>
                  <span className="text-sm font-medium text-white">Active</span>
                </div>

                <div className="pt-4 border-t border-white/[0.06] flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsHhModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-lg bg-[#D4AF37] text-black text-sm font-bold shadow-[0_4px_15px_rgba(212,175,55,0.2)] hover:bg-[#F3C766] disabled:opacity-50 transition-colors"
                  >
                    {isSaving ? 'Saving...' : 'Save Schedule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscountsManagement;
