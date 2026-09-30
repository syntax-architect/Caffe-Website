import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchRestaurantTables, saveRestaurantTable, toggleTableActive } from '../../services/dashboardService';
import { validateAndNormalizeTableNumber } from '../../utils/tableValidation';
import { useNotification } from '../../hooks/useNotification';
import type { RestaurantTable } from '../../types/dashboard';

export const TablesManagement: React.FC = () => {
  const { addNotification } = useNotification();

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals state
  const [activeQrTable, setActiveQrTable] = useState<RestaurantTable | null>(null);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [isAddingTable, setIsAddingTable] = useState<boolean>(false);

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
    // Propose next table number
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

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-on-surface">Floor Tables & QR Codes</h2>
          <p className="text-xs text-outline mt-0.5">
            Manage restaurant dining tables, seat capacities, and customer QR ordering cards.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="py-2.5 px-4 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-2 shadow"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Add New Table
        </button>
      </div>

      {/* Tables Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-outline text-xs">Loading restaurant tables...</div>
      ) : tables.length === 0 ? (
        <div className="py-20 text-center text-outline text-xs bg-surface-container rounded-3xl border border-outline-variant/30">
          <span className="material-symbols-outlined text-4xl mb-2 opacity-40">qr_code_2</span>
          <p className="font-semibold text-sm text-on-surface">No tables configured</p>
          <p className="text-[11px] mt-1">Click "Add New Table" to create your first dining table.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tables.map((table) => {
            const qrTarget = `${originUrl}/qr?table=${table.table_number}`;

            return (
              <div
                key={table.id}
                className={`p-5 rounded-3xl border transition-all shadow-sm flex flex-col justify-between ${
                  table.active
                    ? 'bg-surface-container border-outline-variant/40 hover:border-primary/40'
                    : 'bg-surface-container/50 border-outline-variant/20 opacity-70'
                }`}
              >
                <div>
                  {/* Top table info */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl font-serif font-bold text-primary">
                      Table {table.table_number}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(table)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                        table.active
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                          : 'bg-stone-500/15 text-stone-400 border-stone-500/30 hover:bg-stone-500/25'
                      }`}
                      title="Click to toggle status"
                    >
                      {table.active ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  <p className="text-xs font-medium text-on-surface mb-1">
                    {table.label || 'Dining Area Table'}
                  </p>

                  <div className="flex items-center gap-1.5 text-xs text-outline mb-4">
                    <span className="material-symbols-outlined text-sm">person</span>
                    <span>Capacity: {table.capacity} guests</span>
                  </div>

                  {/* QR Thumbnail Preview */}
                  <div
                    onClick={() => setActiveQrTable(table)}
                    className="p-3 rounded-2xl bg-white flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-shadow group mb-4"
                    title="Click to view large printable QR card"
                  >
                    <QRCodeSVG
                      value={qrTarget}
                      size={110}
                      level="H"
                      includeMargin={false}
                      fgColor="#000000"
                      bgColor="#ffffff"
                    />
                    <span className="text-[10px] text-stone-600 font-semibold mt-1 group-hover:text-primary transition-colors flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">print</span>
                      Print / Expand Card
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs">
                  <a
                    href={qrTarget}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-semibold inline-flex items-center gap-1 text-[11px]"
                  >
                    <span>Test URL</span>
                    <span className="material-symbols-outlined text-xs">open_in_new</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(table)}
                    className="text-outline hover:text-on-surface font-semibold text-[11px]"
                  >
                    Edit Table
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Table Modal */}
      {(isAddingTable || editingTable) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => {
              setIsAddingTable(false);
              setEditingTable(null);
            }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-md bg-surface-container-high border border-outline-variant/60 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-serif font-bold text-on-surface mb-1">
              {editingTable ? `Edit Table ${editingTable.table_number}` : 'Add New Restaurant Table'}
            </h3>
            <p className="text-xs text-outline mb-6">
              Configure table number, label, and seating capacity.
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-error/15 border border-error/30 text-error text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTable} className="space-y-4 text-xs">
              <div>
                <label className="block uppercase font-bold tracking-wider text-outline mb-1">
                  Table Number (01 - 99)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 07"
                  value={tableNumberInput}
                  onChange={(e) => setTableNumberInput(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant/60 rounded-xl px-3 py-2 text-sm text-on-surface font-mono font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block uppercase font-bold tracking-wider text-outline mb-1">
                  Table Location / Label (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Riverside Window Table, Balcony 2"
                  value={tableLabelInput}
                  onChange={(e) => setTableLabelInput(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block uppercase font-bold tracking-wider text-outline mb-1">
                  Seat Capacity (Number of Guests)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={tableCapacityInput}
                  onChange={(e) => setTableCapacityInput(Number(e.target.value))}
                  className="w-full bg-surface-container border border-outline-variant/60 rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingTable(false);
                    setEditingTable(null);
                  }}
                  className="flex-1 py-2.5 rounded-full bg-surface-container hover:bg-surface-container-highest border border-outline-variant/40 font-semibold text-outline hover:text-on-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-full bg-primary text-on-primary font-semibold hover:bg-primary-hover active:scale-95 transition-all shadow"
                >
                  {isSubmitting ? 'Saving...' : 'Save Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable QR Code Modal */}
      {activeQrTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setActiveQrTable(null)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm print:hidden"
          />

          <div className="relative w-full max-w-sm bg-white text-stone-900 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 flex flex-col items-center text-center print:border-none print:shadow-none print:max-w-none print:w-full print:p-0">
            {/* Close button on screen */}
            <button
              type="button"
              onClick={() => setActiveQrTable(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-stone-100 text-stone-500 hover:text-stone-900 print:hidden"
              aria-label="Close QR view"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            {/* Branded Card Header */}
            <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center mb-3 p-2.5 shadow-md">
              <img src="/logo.webp" alt="Logo" className="w-full h-full object-contain filter invert" />
            </div>

            <h3 className="text-lg font-serif font-bold uppercase tracking-[0.16em] text-stone-900">
              The Café Barrackpore
            </h3>
            <p className="text-[10px] text-stone-500 uppercase tracking-widest font-semibold mb-4">
              Smart Table Dine-In
            </p>

            {/* Table Badge */}
            <div className="mb-4 px-6 py-1.5 rounded-full bg-amber-50 border border-amber-300">
              <span className="text-xl font-serif font-black tracking-wider text-amber-900 uppercase">
                TABLE {activeQrTable.table_number}
              </span>
            </div>

            {/* High Contrast Optical QR Code */}
            <div className="bg-white p-3 rounded-2xl shadow-inner border border-stone-200 mb-4">
              <QRCodeSVG
                value={`${originUrl}/qr?table=${activeQrTable.table_number}`}
                size={220}
                level="H"
                includeMargin={true}
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </div>

            <p className="text-xs font-bold text-stone-800">Scan with your smartphone</p>
            <p className="text-[11px] text-stone-500 mb-4">View digital menu & order directly from your seat</p>

            <div className="w-full pt-3 border-t border-stone-200 text-[10px] text-stone-400 uppercase tracking-wider mb-6">
              {activeQrTable.label || '14, Riverside Road, Barrackpore'}
            </div>

            {/* Print Action Buttons (hidden when printing) */}
            <div className="w-full flex gap-3 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-4 rounded-full bg-stone-900 text-white font-semibold text-xs hover:bg-stone-800 transition-colors flex items-center justify-center gap-1.5 shadow"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                Print QR Card
              </button>

              <button
                type="button"
                onClick={() => setActiveQrTable(null)}
                className="py-2.5 px-4 rounded-full bg-stone-100 hover:bg-stone-200 font-semibold text-xs text-stone-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TablesManagement;
