import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNotification } from '../../hooks/useNotification';
import { useSiteConfig } from '../../context/SiteConfigContext';
import type { MenuItem, MenuCategory } from '../../types/menu';
import {
  fetchMenuItems,
  fetchMenuCategories,
  upsertMenuItem,
  updateMenuItemAvailability,
  deleteMenuItem,
  subscribeToMenuRealtime,
  MENU_CATEGORIES_FALLBACK,
} from '../../services/menuService';
import { uploadSiteImage } from '../../services/storageService';

export const MenuManagement: React.FC = () => {
  const { addNotification } = useNotification();
  const { restaurantConfig, formatPrice } = useSiteConfig();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>(MENU_CATEGORIES_FALLBACK);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'nv' | 'vegan'>('all');

  // Modal State
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState<boolean>(false);
  const [isSavingItem, setIsSavingItem] = useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formCategory, setFormCategory] = useState<string>('burgers-pizzas');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formDiet, setFormDiet] = useState<'veg' | 'nv' | 'vegan'>('veg');
  const [formTag, setFormTag] = useState<string>('');
  const [formImageUrl, setFormImageUrl] = useState<string>('');
  const [formAvailable, setFormAvailable] = useState<boolean>(true);
  const [formAllergens, setFormAllergens] = useState<string[]>([]);
  const [formStockCount, setFormStockCount] = useState<string>('');

  // Build category dictionary for labels
  const categoryLabels = useMemo(() => {
    const dict: Record<string, string> = {};
    for (const cat of categories) {
      dict[cat.id] = cat.name;
    }
    return dict;
  }, [categories]);

  const loadMenuData = useCallback(async () => {
    try {
      const [cats, menuItems] = await Promise.all([
        fetchMenuCategories(),
        fetchMenuItems(),
      ]);
      setCategories(cats.length > 0 ? cats : MENU_CATEGORIES_FALLBACK);
      setItems(menuItems);
    } catch (err) {
      console.error('[MenuManagement] Failed loading menu data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadMenuData();

    // Subscribe to realtime database changes on menu_items and menu_categories
    const unsubscribe = subscribeToMenuRealtime(() => {
      if (isMounted) {
        loadMenuData();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [loadMenuData]);

  const ALLERGEN_OPTIONS = ['Dairy', 'Gluten', 'Nuts', 'Peanuts', 'Soy', 'Eggs', 'Fish', 'Shellfish', 'Sesame'];

  const toggleFormAllergen = (allergen: string) => {
    setFormAllergens((prev) =>
      prev.includes(allergen) ? prev.filter((a) => a !== allergen) : [...prev, allergen]
    );
  };

  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormPrice(item.price);
    setFormCategory(item.category_id || item.category || 'burgers-pizzas');
    setFormDescription(item.description || '');
    setFormDiet((item.diet === 'nv' ? 'nv' : item.diet === 'vegan' ? 'vegan' : 'veg') as any);
    setFormTag(item.tag || (item.popular ? 'Bestseller' : ''));
    setFormImageUrl(item.image_url || item.image || '');
    setFormAvailable(item.available !== false);
    setFormAllergens(item.allergens || []);
    setFormStockCount(item.stock_count !== undefined && item.stock_count !== null ? String(item.stock_count) : '');
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormName('');
    setFormPrice(250);
    setFormCategory(categories[0]?.id || 'burgers-pizzas');
    setFormDescription('');
    setFormDiet('veg');
    setFormTag('');
    setFormImageUrl('');
    setFormAvailable(true);
    setFormAllergens([]);
    setFormStockCount('');
    setIsAddingItem(true);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    addNotification('info', 'Uploading Image', `Uploading "${file.name}" to Storage...`);

    const result = await uploadSiteImage(file, 'menu');
    setIsUploadingImage(false);

    if (result.success && result.url) {
      setFormImageUrl(result.url);
      addNotification('success', 'Image Uploaded', 'Dish photo uploaded to site-images bucket.');
    } else {
      addNotification('error', 'Upload Failed', result.error || 'Could not upload image.');
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || formPrice <= 0 || isSavingItem) return;

    setIsSavingItem(true);
    const targetId = editingItem ? editingItem.id : `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const result = await upsertMenuItem({
      id: targetId,
      category_id: formCategory,
      name: formName.trim(),
      price: Number(formPrice),
      description: formDescription.trim() || undefined,
      diet: formDiet,
      popular: Boolean(formTag.trim()),
      available: formAvailable,
      image_url: formImageUrl.trim() || undefined,
      sort_order: editingItem?.sort_order ?? items.length + 1,
      allergens: formAllergens,
      stock_count: formStockCount.trim() !== '' ? parseInt(formStockCount, 10) : null,
    });

    setIsSavingItem(false);

    if (result.success && result.item) {
      const savedItem = result.item;
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.id === savedItem.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = savedItem;
          return next;
        }
        return [savedItem, ...prev];
      });

      addNotification(
        'success',
        editingItem ? 'Menu Item Updated' : 'Menu Item Created',
        `"${formName}" has been persisted to the database and is live on the website.`
      );
      setEditingItem(null);
      setIsAddingItem(false);
    } else {
      addNotification('error', 'Save Failed', result.error || 'Failed to persist menu item to database.');
    }
  };

  const handleToggleAvailability = async (id: string, name: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const next = !item.available;
    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, available: next } : i))
    );

    const res = await updateMenuItemAvailability(id, next);
    if (res.success) {
      addNotification(
        next ? 'success' : 'warning',
        next ? 'Item In Stock' : "Item Sold Out (86'd)",
        `"${name}" is now marked as ${next ? 'Available' : "Sold Out (86'd)"} for service across customer and QR ordering.`
      );
    } else {
      // Revert on failure
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, available: !next } : i))
      );
      addNotification('error', 'Update Failed', res.error || 'Failed to update item availability in database.');
    }
  };

  const handleDeleteItem = async (item: MenuItem) => {
    const confirmed = window.confirm(`Are you sure you want to permanently delete "${item.name}" from the menu catalog?`);
    if (!confirmed) return;

    const res = await deleteMenuItem(item.id);
    if (res.success) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      addNotification('info', 'Item Deleted', `"${item.name}" was removed from the database.`);
      setEditingItem(null);
    } else {
      addNotification('error', 'Delete Failed', res.error || 'Failed to delete menu item.');
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      const itemCat = item.category_id || item.category;
      if (selectedCategory !== 'all' && itemCat !== selectedCategory) {
        return false;
      }
      // Diet filter
      if (dietFilter === 'veg' && item.diet !== 'veg' && item.diet !== 'vegan') {
        return false;
      }
      if (dietFilter === 'nv' && item.diet !== 'nv') {
        return false;
      }
      if (dietFilter === 'vegan' && item.diet !== 'vegan') {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const catLabel = (categoryLabels[itemCat || ''] || itemCat || '').toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.description || '').toLowerCase().includes(q) ||
          catLabel.includes(q)
        );
      }
      return true;
    });
  }, [items, selectedCategory, dietFilter, searchQuery, categoryLabels]);

  const activeCount = useMemo(() => items.filter((i) => i.available).length, [items]);
  const outOfStockCount = useMemo(() => items.filter((i) => !i.available).length, [items]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* COCKPIT HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
              Culinary Catalog & 86'd Station
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-black text-white mt-1 tracking-tight">
            Menu & Availability
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
            Instant 86'd toggles for kitchen service, real-time catalog pricing, and automatic Supabase synchronization across table QR and online delivery.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="relative group overflow-hidden px-5 py-3 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F3C766] to-[#D4AF37] text-[#070605] text-xs font-black tracking-wider uppercase shadow-[0_10px_30px_rgba(212,175,55,0.25)] hover:shadow-[0_15px_40px_rgba(212,175,55,0.4)] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base font-bold">add</span>
          <span>Add Menu Item</span>
        </button>
      </div>

      {/* OVERVIEW STATS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Total Items</p>
            <p className="text-xl sm:text-2xl font-serif font-bold text-white mt-0.5">{items.length}</p>
          </div>
        </div>
        <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">In Stock</p>
            <p className="text-xl sm:text-2xl font-serif font-bold text-emerald-400 mt-0.5">{activeCount}</p>
          </div>
        </div>
        <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-rose-400">86'd (Sold Out)</p>
            <p className="text-xl sm:text-2xl font-serif font-bold text-rose-400 mt-0.5">{outOfStockCount}</p>
          </div>
        </div>
        <div className="p-1 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="p-3.5 rounded-[calc(1rem-0.125rem)] bg-[#120F0D]">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#D4AF37]">Categories</p>
            <p className="text-xl sm:text-2xl font-serif font-bold text-[#D4AF37] mt-0.5">
              {categories.length}
            </p>
          </div>
        </div>
      </div>

      {/* SECURITY / ARCHITECTURE NOTICE */}
      <div className="p-1 rounded-2xl bg-gradient-to-b from-[#D4AF37]/20 via-white/[0.04] to-transparent border border-[#D4AF37]/30">
        <div className="p-4 rounded-[calc(1rem-0.125rem)] bg-[#120F0D] flex items-start gap-3.5 text-xs">
          <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-lg">database</span>
          </div>
          <div>
            <p className="font-serif font-bold text-white text-sm">Supabase Realtime Menu Catalog & Storage</p>
            <p className="text-zinc-400 text-[11px] leading-relaxed mt-0.5">
              Catalog mutations and availability toggles write directly to postgres with Row Level Security. Connected guests and kitchen displays update automatically via Supabase Realtime without redeploying.
            </p>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTERS DOCK */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search input with double-bezel border */}
        <div className="relative flex-1 max-w-lg">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-lg pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search dish by name, ingredients, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#120F0D] border border-white/[0.08] focus:border-[#D4AF37] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#D4AF37] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Dietary Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#120F0D] border border-white/[0.06] overflow-x-auto">
          {(['all', 'veg', 'nv', 'vegan'] as const).map((diet) => (
            <button
              key={diet}
              type="button"
              onClick={() => setDietFilter(diet)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                dietFilter === diet
                  ? 'bg-[#D4AF37] text-[#070605] shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              {diet === 'all' ? 'All Diets' : diet === 'nv' ? 'Non-Veg' : diet}
            </button>
          ))}
        </div>
      </div>

      {/* CATEGORY TABS STRIP */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
            selectedCategory === 'all'
              ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/40'
              : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white'
          }`}
        >
          All Categories ({items.length})
        </button>
        {categories.map((cat) => {
          const count = items.filter((i) => (i.category_id || i.category) === cat.id).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                selectedCategory === cat.id
                  ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/40'
                  : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white'
              }`}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {/* ITEMS CATALOG TABLE */}
      {isLoading ? (
        <div className="p-12 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#D4AF37] border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-xs text-zinc-400 font-mono">Loading restaurant menu from database...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 rounded-3xl bg-[#120F0D] border border-white/[0.06] text-center">
          <span className="material-symbols-outlined text-4xl text-zinc-600 mb-2">restaurant_menu</span>
          <p className="font-serif font-bold text-white text-base">No Menu Items Found</p>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No dishes matched "${searchQuery}". Try a different keyword.`
              : 'No items currently exist in this category.'}
          </p>
        </div>
      ) : (
        <div className="p-1 rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl overflow-hidden">
          <div className="rounded-[calc(1.5rem-0.125rem)] bg-[#120F0D] overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] font-mono uppercase tracking-wider text-zinc-400 bg-white/[0.02]">
                  <th className="py-3.5 px-6">Dish Details</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Diet</th>
                  <th className="py-3.5 px-4">Price</th>
                  <th className="py-3.5 px-4">Stock Inventory</th>
                  <th className="py-3.5 px-4">Service Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs">
                {filteredItems.map((item) => {
                  const displayImage = item.image_url || item.image;
                  const itemCat = item.category_id || item.category || '';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center">
                            {displayImage ? (
                              <img
                                src={displayImage}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="material-symbols-outlined text-zinc-600 text-xl">
                                restaurant
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-serif font-bold text-white text-sm group-hover:text-[#D4AF37] transition-colors">
                                {item.name}
                              </p>
                              {(item.tag || item.popular) && (
                                <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[9px] font-mono font-bold uppercase tracking-wider">
                                  {item.tag || 'Bestseller'}
                                </span>
                              )}
                            </div>
                            <p className="text-zinc-400 text-[11px] line-clamp-1 mt-0.5 max-w-md">
                              {item.description || 'No description provided.'}
                            </p>
                            {item.allergens && item.allergens.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap mt-1">
                                {item.allergens.map((alg) => (
                                  <span key={alg} className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                    {alg}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-zinc-400 font-mono text-[11px]">
                        {categoryLabels[itemCat] || itemCat}
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            item.diet === 'veg'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : item.diet === 'vegan'
                              ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {item.diet || 'veg'}
                        </span>
                      </td>

                      <td className="py-4 px-4 font-mono font-bold text-white text-sm">
                        {formatPrice(item.price)}
                      </td>

                      <td className="py-4 px-4 font-mono text-[11px]">
                        {item.stock_count === null || item.stock_count === undefined ? (
                          <span className="text-zinc-500 font-sans text-[10px]">Unlimited</span>
                        ) : item.stock_count === 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold">
                            SOLD OUT (0)
                          </span>
                        ) : item.stock_count <= 5 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            Low Stock ({item.stock_count})
                          </span>
                        ) : (
                          <span className="text-zinc-300">{item.stock_count} units</span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(item.id, item.name)}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border transition-all flex items-center gap-2 cursor-pointer ${
                            item.available
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                          }`}
                          title="Click to toggle availability"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.available ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                            }`}
                          />
                          <span>{item.available ? 'In Stock (Live)' : "86'd (Sold Out)"}</span>
                        </button>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.06] text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Edit Item
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DOUBLE-BEZEL ADD / EDIT MODAL */}
      {(isAddingItem || editingItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => {
              setIsAddingItem(false);
              setEditingItem(null);
            }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          <div className="relative w-full max-w-lg p-1.5 rounded-[2rem] bg-gradient-to-b from-white/[0.15] via-white/[0.05] to-white/[0.02] border border-white/[0.1] shadow-2xl z-10 animate-in zoom-in-95 duration-200">
            <div className="rounded-[calc(2rem-0.375rem)] bg-[#120F0D] p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-5">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37]">
                    Catalog Mutation
                  </span>
                  <h3 className="text-xl font-serif font-black text-white mt-0.5">
                    {editingItem ? `Edit: ${editingItem.name}` : 'Add Menu Item'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingItem(false);
                    setEditingItem(null);
                  }}
                  className="p-1.5 rounded-full bg-white/[0.05] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
                <div>
                  <label className="block uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Dish Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Signature Truffle Pizza"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                      Base Price ({restaurantConfig.currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      required
                      value={formPrice}
                      onChange={(e) => setFormPrice(Number(e.target.value))}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                      Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id} className="bg-[#120F0D] text-white">
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                      Stock Count (Empty = Unlimited)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={formStockCount}
                      onChange={(e) => setFormStockCount(e.target.value)}
                      placeholder="Unlimited"
                      className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* IMAGE UPLOAD TO STORAGE BUCKET */}
                <div>
                  <label className="block uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Dish Photo (Storage Bucket: site-images)
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl bg-black/40 border border-white/[0.1] overflow-hidden shrink-0 flex items-center justify-center">
                      {formImageUrl ? (
                        <img src={formImageUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-zinc-600 text-2xl">image</span>
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-semibold text-white transition-colors cursor-pointer">
                        <span className="material-symbols-outlined text-base">cloud_upload</span>
                        <span>{isUploadingImage ? 'Uploading...' : 'Upload Image'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          disabled={isUploadingImage}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="url"
                        placeholder="Or enter public image URL..."
                        value={formImageUrl}
                        onChange={(e) => setFormImageUrl(e.target.value)}
                        className="w-full bg-[#070605] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[11px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Dietary Classification
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['veg', 'nv', 'vegan'] as const).map((diet) => (
                      <button
                        key={diet}
                        type="button"
                        onClick={() => setFormDiet(diet)}
                        className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          formDiet === diet
                            ? 'bg-[#D4AF37] text-[#070605] border-[#D4AF37]'
                            : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-white'
                        }`}
                      >
                        {diet === 'nv' ? 'Non-Veg' : diet}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Badge Tag (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bestseller, Chef Pick, Seasonal"
                    value={formTag}
                    onChange={(e) => setFormTag(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Allergen Warnings (Select all that apply)
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-[#070605] border border-white/[0.1]">
                    {ALLERGEN_OPTIONS.map((alg) => {
                      const selected = formAllergens.includes(alg);
                      return (
                        <button
                          key={alg}
                          type="button"
                          onClick={() => toggleFormAllergen(alg)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer border ${
                            selected
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                              : 'bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white'
                          }`}
                        >
                          {selected ? `✓ ${alg}` : `+ ${alg}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block uppercase font-mono font-bold tracking-wider text-zinc-400 mb-1.5">
                    Description & Ingredients
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe flavor profiles, garnishes, and notes..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-[#070605] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37] resize-none"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white text-xs">Immediate Service Availability</p>
                    <p className="text-[10px] text-zinc-400">Available to customers upon saving</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formAvailable}
                    onChange={(e) => setFormAvailable(e.target.checked)}
                    className="w-5 h-5 rounded accent-[#D4AF37] cursor-pointer"
                  />
                </div>

                <div className="pt-4 flex items-center gap-3">
                  {editingItem && (
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(editingItem)}
                      className="py-3 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-xs transition-colors cursor-pointer"
                      title="Permanently delete from database"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingItem(false);
                      setEditingItem(null);
                    }}
                    className="flex-1 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] font-bold text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingItem}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] font-black text-xs uppercase tracking-wider hover:shadow-[0_10px_25px_rgba(212,175,55,0.3)] transition-all cursor-pointer"
                  >
                    {isSavingItem ? 'Persisting...' : 'Save Item'}
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

export default MenuManagement;
