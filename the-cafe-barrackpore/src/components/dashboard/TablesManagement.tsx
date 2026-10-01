import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchRestaurantTables, saveRestaurantTable, toggleTableActive } from '../../services/dashboardService';
import { validateAndNormalizeTableNumber } from '../../utils/tableValidation';
import { useNotification } from '../../hooks/useNotification';
import { buildTableQrUrl } from '../../utils/url';
import type { RestaurantTable } from '../../types/dashboard';

export const TablesManagement: React.FC = () => {
  const { addNotification } = useNotification();

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals state
  const [activeQrTable, setActiveQrTable] = useState<RestaurantTable | null>(null);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [isAddingTable, setIsAddingTable] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Form state
  const [tableNumberInput, setTableNumberInput] = useState<string>('');
  const [tableLabelInput, setTableLabelInput] = useState<string>('');
  const [tableCapacityInput, setTableCapacityInput] = useState<number>(4);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadTables = () => {
    setIsLoading(true);
    fetchRestaurantTables()
      .then((data) => setTables(data))
      .catch((err) => console.error('Failed to load tables:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    let isMounted = true;
    fetchRestaurantTables().then((data) => {
      if (isMounted) {
        setTables(data);
        setIsLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenAddModal = () => {
    const maxNum = tables.reduce((max, t) => {
      const n = parseInt(t.table_number, 10);
      return !isNaN(n) && n > max ? n : max;
    }, 0);
    const nextTableStr = String(maxNum + 1).padStart(2, '0');

    setTableNumberInput(nextTableStr);
    setTableLabelInput('');
    setTableCapacityInput(4);
    setFormError(null);
    setIsAddingTable(true);
  };

  const handleOpenEditModal = (table: RestaurantTable) => {
    setEditingTable(table);
    setTableNumberInput(table.table_number);
    setTableLabelInput(table.label || '');
    setTableCapacityInput(table.capacity);
    setFormError(null);
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const norm = validateAndNormalizeTableNumber(tableNumberInput);
    if (!norm.isValid || !norm.tableNumber) {
      setFormError(norm.error || 'Please enter a valid table number between 01 and 99.');
      return;
    }

    if (tableCapacityInput < 1 || tableCapacityInput > 50) {
      setFormError('Capacity must be between 1 and 50 seats.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<RestaurantTable> = {
        id: editingTable?.id,
        table_number: norm.tableNumber,
        label: tableLabelInput.trim() || null,
        capacity: tableCapacityInput,
      };

      const res = await saveRestaurantTable(payload);
      if (res.success) {
        addNotification(
          'success',
          'Table Saved',
          `Table ${norm.tableNumber} was successfully ${editingTable ? 'updated' : 'created'}.`
        );
        setIsAddingTable(false);
        setEditingTable(null);
        await loadTables();
      } else {
        setFormError(res.error || 'Failed to save table.');
      }
    } catch {
      setFormError('Unexpected error while saving table.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (table: RestaurantTable) => {
    try {
      const nextActive = !table.active;
      const res = await toggleTableActive(table.id, nextActive);
      if (res.success) {
        addNotification(
          'warning',
          'Table Status Changed',
          `Table ${table.table_number} is now ${nextActive ? 'Active' : 'Deactivated'}.`
        );
        setTables((prev) =>
          prev.map((t) => (t.id === table.id ? { ...t, active: nextActive } : t))
        );
      } else {
        addNotification('error', 'Status Update Failed', res.error || 'Could not toggle table status.');
      }
    } catch {
      addNotification('error', 'Error', 'Failed to toggle table status.');
    }
  };

  const handleCopyQrUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    addNotification('info', 'URL Copied', 'Direct table ordering link copied to clipboard.');
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER COCKPIT */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
              Floor Architecture & Optical Dispatch
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-black text-white mt-1 tracking-tight">
            Floor Tables & Smart QR
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
            Manage physical dining covers, table seating capacities, optical tabletop QR stands, and real-time seat activation.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="relative group overflow-hidden px-5 py-3 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F3C766] to-[#D4AF37] text-[#070605] text-xs font-black tracking-wider uppercase shadow-[0_10px_30px_rgba(212,175,55,0.25)] hover:shadow-[0_15px_40px_rgba(212,175,55,0.4)] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base font-bold">add</span>
          <span>Add Dining Table</span>
        </button>
      </div>

      {/* STATS OVERVIEW STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Total Tables</p>
            <p className="text-xl sm:text-2xl font-serif font-bold text-white mt-0.5">{tables.length}</p>
          </div>
        </div>
        <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">Active Service</p>
            <p className="text-xl sm:text-2xl font-serif font-bold text-emerald-400 mt-0.5">
              {tables.filter((t) => t.active).length}
            </p>
          </div>
        </div>
        <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Total Seating</p>
            <p className="text-xl sm:text-2xl font-serif font-bold text-white mt-0.5">
              {tables.reduce((sum, t) => sum + (t.capacity || 0), 0)} covers
            </p>
          </div>
        </div>
        <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF37]">QR Dispatch</p>
            <p className="text-xl sm:text-2xl font-serif font-bold text-[#D4AF37] mt-0.5">100% Ready</p>
          </div>
        </div>
      </div>

      {/* TABLES HARDWARE GRID */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-72 rounded-[1.75rem] bg-[#120F0D] border border-white/[0.06]" />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <div className="p-1.5 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="py-20 text-center rounded-[calc(2rem-0.375rem)] bg-[#120F0D] flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-zinc-500 mb-4">
              <span className="material-symbols-outlined text-3xl">qr_code_2</span>
            </div>
            <h3 className="text-lg font-serif font-bold text-white">No dining tables configured</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm">
              Initialize your dining room layout by clicking "Add Dining Table" above.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {tables.map((table) => {
            const qrTarget = buildTableQrUrl(table.table_number);

            return (
              <div
                key={table.id}
                className={`group relative p-1 rounded-[1.75rem] transition-all duration-300 ${
                  table.active
                    ? 'bg-gradient-to-b from-white/[0.12] via-white/[0.04] to-white/[0.01] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-[#D4AF37]/50 hover:shadow-[0_12px_40px_rgba(212,175,55,0.15)]'
                    : 'bg-white/[0.02] border border-white/[0.04] opacity-60'
                }`}
              >
                <div className="p-5 rounded-[calc(1.75rem-0.25rem)] bg-[#120F0D] flex flex-col justify-between h-full relative overflow-hidden">
                  {/* Subtle top edge glow */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 transition-opacity ${
                      table.active
                        ? 'bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent group-hover:opacity-100 opacity-60'
                        : 'bg-transparent'
                    }`}
                  />

                  {/* Card Header: Table Number & Status Pill */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[10px] font-mono tracking-widest uppercase text-zinc-400">TABLE</span>
                        <span className="text-2xl sm:text-3xl font-serif font-black text-white tracking-tight group-hover:text-[#D4AF37] transition-colors">
                          {table.table_number}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleActive(table)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${
                          table.active
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                        }`}
                        title="Click to toggle table availability"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            table.active ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                          }`}
                        />
                        <span>{table.active ? 'Active' : 'Off-Duty'}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs mb-4">
                      <p className="font-medium text-zinc-300 truncate max-w-[140px]">
                        {table.label || 'Dining Area Table'}
                      </p>
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] font-mono text-[#D4AF37] flex items-center gap-1 shrink-0">
                        <span className="material-symbols-outlined text-xs">group</span>
                        <span>{table.capacity} Seats</span>
                      </span>
                    </div>

                    {/* QR Code Presentation Box */}
                    <div
                      onClick={() => setActiveQrTable(table)}
                      className="relative p-3.5 rounded-2xl bg-white flex flex-col items-center justify-center cursor-pointer shadow-lg group-hover:shadow-[0_8px_25px_rgba(212,175,55,0.2)] transition-all transform group-hover:-translate-y-0.5"
                      title="Click to inspect and print table tent card"
                    >
                      <QRCodeSVG
                        value={qrTarget}
                        size={110}
                        level="H"
                        includeMargin={false}
                        fgColor="#070605"
                        bgColor="#ffffff"
                      />
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-zinc-800 group-hover:text-black">
                        <span className="material-symbols-outlined text-xs">print</span>
                        <span>Print Table Stand</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between text-xs">
                    <a
                      href={qrTarget}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#D4AF37] hover:text-[#F3C766] font-mono font-semibold inline-flex items-center gap-1 text-[11px] transition-colors"
                    >
                      <span>Launch Preview</span>
                      <span className="material-symbols-outlined text-xs">open_in_new</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(table)}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.06] text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Edit Config
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LUXURY PRINTABLE QR STAND MODAL */}
      {activeQrTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setActiveQrTable(null)}
            className="fixed inset-0 bg-black/80 backdrop-blur-md print:hidden"
          />

          <div className="relative w-full max-w-sm bg-gradient-to-b from-[#140F0B] to-[#0A0706] text-white rounded-[2rem] border border-[#D4AF37]/30 p-6 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.9)] z-10 flex flex-col items-center text-center animate-in zoom-in-95 duration-200 print:bg-white print:text-black print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none">
            {/* Close button (screen only) */}
            <button
              type="button"
              onClick={() => setActiveQrTable(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-zinc-400 hover:text-white border border-white/[0.08] transition-colors print:hidden cursor-pointer"
              aria-label="Close QR view"
            >
              <span className="material-symbols-outlined text-base leading-none">close</span>
            </button>

            {/* Table Tent Graphic Frame (Fine-Dining Luxury Styling) */}
            <div className="w-full p-6 rounded-3xl bg-[#070605] border-2 border-[#D4AF37] print:border-2 print:border-black print:bg-white flex flex-col items-center relative overflow-hidden shadow-2xl">
              {/* Gold Filigree Accent Header */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#997722] p-0.5 mb-3 shadow-md">
                <div className="w-full h-full rounded-full bg-[#070605] print:bg-white flex items-center justify-center">
                  <span className="font-serif font-black text-[#D4AF37] print:text-black text-sm">CB</span>
                </div>
              </div>

              <h4 className="text-base font-serif font-black uppercase tracking-[0.2em] text-[#D4AF37] print:text-black">
                The Café Barrackpore
              </h4>
              <p className="text-[9px] font-mono tracking-[0.25em] text-zinc-400 print:text-zinc-600 uppercase mt-0.5 mb-4">
                Smart Table Service
              </p>

              {/* Table Pill */}
              <div className="mb-4 px-6 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/40 print:border-black print:bg-zinc-100">
                <span className="text-lg font-serif font-black tracking-wider text-[#D4AF37] print:text-black uppercase">
                  TABLE {activeQrTable.table_number}
                </span>
              </div>

              {/* Optical High Contrast QR SVG */}
              <div className="bg-white p-3 rounded-2xl shadow-xl border border-zinc-200 mb-4">
                <QRCodeSVG
                  value={buildTableQrUrl(activeQrTable.table_number)}
                  size={200}
                  level="H"
                  includeMargin={false}
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              </div>

              <p className="text-xs font-bold text-white print:text-black">Scan with camera to order</p>
              <p className="text-[10px] text-zinc-400 print:text-zinc-600 mt-0.5">
                Browse menu & dispatch directly to kitchen
              </p>

              <div className="w-full pt-3 mt-4 border-t border-white/[0.08] print:border-zinc-300 text-[9px] font-mono text-zinc-400 print:text-zinc-500 uppercase tracking-widest">
                {activeQrTable.label || '14, Riverside Road, Barrackpore'}
              </div>
            </div>

            {/* Quick Action Buttons (hidden in print) */}
            <div className="w-full flex flex-col gap-2 mt-6 print:hidden">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] font-black text-xs tracking-wider uppercase hover:shadow-[0_10px_25px_rgba(212,175,55,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm font-bold">print</span>
                  <span>Print Table Stand</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyQrUrl(buildTableQrUrl(activeQrTable.table_number))}
                  className="px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 border border-white/[0.08] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Copy QR Order Link"
                >
                  <span className="material-symbols-outlined text-sm">
                    {copiedUrl ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedUrl ? 'Copied' : 'Link'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setActiveQrTable(null)}
                className="w-full py-2.5 rounded-xl text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOUBLE-BEZEL ADD / EDIT MODAL */}
      {(isAddingTable || editingTable) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => {
              setIsAddingTable(false);
              setEditingTable(null);
            }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          <div className="relative w-full max-w-md p-1.5 rounded-[2rem] bg-gradient-to-b from-white/[0.15] via-white/[0.05] to-white/[0.02] border border-white/[0.1] shadow-2xl z-10 animate-in zoom-in-95 duration-200">
            <div className="rounded-[calc(2rem-0.375rem)] bg-[#120F0D] p-6 sm:p-8">
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-5">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                    Dining Room Configuration
                  </span>
                  <h3 className="text-xl font-serif font-black text-white mt-0.5">
                    {editingTable ? `Edit Table ${editingTable.table_number}` : 'Add New Dining Table'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingTable(false);
                    setEditingTable(null);
                  }}
                  className="p-1.5 rounded-full bg-white/[0.05] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-red-400">error</span>
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveTable} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Table Identifier (01 - 99)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 07"
                    value={tableNumberInput}
                    onChange={(e) => setTableNumberInput(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-base text-white font-mono font-bold focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">Customers access this table via QR code or direct link.</p>
                </div>

                <div>
                  <label className="block uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Table Location / Label (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Riverside Window Table, Balcony 2"
                    value={tableLabelInput}
                    onChange={(e) => setTableLabelInput(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
                  />
                </div>

                <div>
                  <label className="block uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Seating Capacity (Guests)
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setTableCapacityInput((c) => Math.max(1, c - 1))}
                      className="w-10 h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.08] text-base font-bold flex items-center justify-center transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      required
                      value={tableCapacityInput}
                      onChange={(e) => setTableCapacityInput(Number(e.target.value))}
                      className="flex-1 bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-center text-sm font-mono font-bold text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                    <button
                      type="button"
                      onClick={() => setTableCapacityInput((c) => Math.min(50, c + 1))}
                      className="w-10 h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.08] text-base font-bold flex items-center justify-center transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingTable(false);
                      setEditingTable(null);
                    }}
                    className="flex-1 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] font-bold text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] font-black text-xs uppercase tracking-wider hover:shadow-[0_10px_25px_rgba(212,175,55,0.3)] transition-all cursor-pointer"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Table'}
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

export default TablesManagement;
