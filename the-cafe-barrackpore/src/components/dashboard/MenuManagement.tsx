import React, { useState, useEffect, useMemo } from 'react';
import { client, urlFor } from '../../lib/sanityClient';
import { menuData } from '../../data/menu';
import { useNotification } from '../../hooks/useNotification';
import { useSiteConfig } from '../../context/SiteConfigContext';

import {
  setMenuItemAvailability,
  getLocalAvailabilityMap,
  isItemAvailable,
} from '../../services/menuAvailabilityService';
import {
  getPersistedMenuItems,
  saveMenuItemMutation,
} from '../../services/contentPersistenceService';

export interface EditableMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  diet: 'veg' | 'nv' | 'vegan';
  tag?: string;
  available: boolean;
  image?: any;
}

// Category mapping defined at module scope for stable reference
const categoryLabels: Record<string, string> = {
  'burgers-pizzas': 'Burgers & Pizzas',
  'starters-momos': 'Starters & Momos',
  'mains-platters': 'Mains & Platters',
  'sips-desserts': 'Sips & Desserts',
  'soups-salads': 'Soups & Salads',
};

const fetchInitialMenuItems = async (): Promise<EditableMenuItem[]> => {
  const localMap = getLocalAvailabilityMap();
  const persistedMenu = getPersistedMenuItems();

  let baseItems: EditableMenuItem[] = menuData.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    category: item.category,
    diet: item.diet === 'nv' ? 'nv' : item.diet === 'vegan' ? 'vegan' : 'veg',
    tag: item.tag || undefined,
    available: isItemAvailable(item.id, localMap),
    image: item.image,
  }));

  if (client) {
    try {
      const query = `*[_type == "menuItem"]{
        _id,
        name,
        description,
        price,
        category,
        dietType,
        popular,
        image
      }`;
      const sanityItems = await client.fetch(query);
      if (Array.isArray(sanityItems) && sanityItems.length > 0) {
        baseItems = sanityItems.map((cms) => ({
          id: cms._id,
          name: cms.name,
          description: cms.description || '',
          price: Number(cms.price) || 0,
          category: cms.category || 'burgers-pizzas',
          diet: cms.dietType === 'non-veg' ? 'nv' : cms.dietType === 'vegan' ? 'vegan' : 'veg',
          tag: cms.popular ? 'Bestseller' : undefined,
          available: isItemAvailable(cms._id, localMap),
          image: cms.image,
        }));
      }
    } catch (err) {
      console.warn('[MenuManagement] Failed to fetch CMS items, using local menu dataset:', err);
    }
  }

  // Merge any persisted custom / edited menu items
  const mergedItems = baseItems.map((item) => {
    const override = persistedMenu[item.id];
    if (override) {
      return {
        ...item,
        ...override,
        available: isItemAvailable(item.id, localMap),
      };
    }
    return item;
  });

  const baseIds = new Set(baseItems.map((i) => i.id));
  const additions: EditableMenuItem[] = [];
  for (const id of Object.keys(persistedMenu)) {
    if (!baseIds.has(id)) {
      additions.push({
        ...persistedMenu[id],
        available: isItemAvailable(id, localMap),
      });
    }
  }

  return [...additions, ...mergedItems];
};

export const MenuManagement: React.FC = () => {
  const { addNotification } = useNotification();
  const { restaurantConfig, formatPrice } = useSiteConfig();

  const [items, setItems] = useState<EditableMenuItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'nv' | 'vegan'>('all');

  // Modal State
  const [editingItem, setEditingItem] = useState<EditableMenuItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState<boolean>(false);
  const [isSavingItem, setIsSavingItem] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formCategory, setFormCategory] = useState<string>('burgers-pizzas');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formDiet, setFormDiet] = useState<'veg' | 'nv' | 'vegan'>('veg');
  const [formTag, setFormTag] = useState<string>('');
  const [formAvailable, setFormAvailable] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    fetchInitialMenuItems().then((data) => {
      if (!isMounted) return;
      setItems(data);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleReloadMenu = () => {
    setIsLoading(true);
    fetchInitialMenuItems().then((data) => {
      setItems(data);
      setIsLoading(false);
    });
  };

  const handleOpenEdit = (item: EditableMenuItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormPrice(item.price);
    setFormCategory(item.category);
    setFormDescription(item.description);
    setFormDiet(item.diet);
    setFormTag(item.tag || '');
    setFormAvailable(item.available);
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormName('');
    setFormPrice(250);
    setFormCategory('burgers-pizzas');
    setFormDescription('');
    setFormDiet('veg');
    setFormTag('');
    setFormAvailable(true);
    setIsAddingItem(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || formPrice <= 0 || isSavingItem) return;

    setIsSavingItem(true);
    const targetId = editingItem ? editingItem.id : `item-custom-${Date.now()}`;
    const itemToPersist: EditableMenuItem = {
      id: targetId,
      name: formName.trim(),
      price: Number(formPrice),
      category: formCategory,
      description: formDescription.trim(),
      diet: formDiet,
      tag: formTag.trim() || undefined,
      available: formAvailable,
      image: editingItem?.image,
    };

    try {
      await saveMenuItemMutation(itemToPersist);
      await setMenuItemAvailability(targetId, formAvailable);

      setItems((prev) => {
        const exists = prev.some((i) => i.id === targetId);
        if (exists) {
          return prev.map((i) => (i.id === targetId ? itemToPersist : i));
        }
        return [itemToPersist, ...prev];
      });

      addNotification(
        'success',
        editingItem ? 'Menu Item Updated' : 'Menu Item Added',
        `"${formName}" has been persisted to the restaurant catalog and public website.`
      );
      setEditingItem(null);
      setIsAddingItem(false);
    } catch {
      addNotification('error', 'Save Failed', 'Could not persist menu item updates.');
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleToggleAvailability = async (id: string, name: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const next = !item.available;
    await setMenuItemAvailability(id, next);
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, available: next } : i))
    );
    addNotification(
      next ? 'success' : 'warning',
      next ? 'Item In Stock' : 'Item Sold Out (86\'d)',
      `"${name}" is now marked as ${next ? 'Available' : 'Sold Out (86\'d)'} for service across customer and QR ordering.`
    );
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
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
        return (
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (categoryLabels[item.category] || item.category).toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, selectedCategory, dietFilter, searchQuery]);

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
            Instant 86'd toggles for kitchen service, real-time catalog pricing, and automatic sync across table QR and online delivery.
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
              {Object.keys(categoryLabels).length}
            </p>
          </div>
        </div>
      </div>

      {/* SECURITY / CMS ARCHITECTURE NOTICE */}
      <div className="p-1 rounded-2xl bg-gradient-to-b from-[#D4AF37]/20 via-white/[0.04] to-transparent border border-[#D4AF37]/30">
        <div className="p-4 rounded-[calc(1rem-0.125rem)] bg-[#120F0D] flex items-start gap-3.5 text-xs">
          <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-lg">shield</span>
          </div>
          <div>
            <p className="font-serif font-bold text-white text-sm">Enterprise CMS Write-Path Security</p>
            <p className="text-zinc-400 text-[11px] leading-relaxed mt-0.5">
              Availability and 86'd sold-out states update instantly in-memory and in restaurant dispatch. Catalog mutations are signed and persisted with strict origin controls.
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
            placeholder="Search dishes, ingredients, or descriptions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#120F0D] border border-white/[0.08] rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {/* Diet Filter Pills */}
          <div className="bg-[#120F0D] p-1 rounded-xl border border-white/[0.08] flex items-center gap-1 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setDietFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                dietFilter === 'all'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#F3C766] text-[#070605] shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setDietFilter('veg')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                dietFilter === 'veg'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Veg
            </button>
            <button
              type="button"
              onClick={() => setDietFilter('nv')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                dietFilter === 'nv'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              Non-Veg
            </button>
          </div>

          <button
            type="button"
            onClick={handleReloadMenu}
            className="p-2.5 rounded-xl bg-[#120F0D] hover:bg-white/[0.05] border border-white/[0.08] text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Reload Menu from Server"
          >
            <span className="material-symbols-outlined text-lg leading-none">refresh</span>
          </button>
        </div>
      </div>

      {/* CATEGORY SELECTOR TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none text-xs border-b border-white/[0.06]">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-xl font-mono text-[11px] uppercase tracking-wider font-bold whitespace-nowrap transition-all cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-[#D4AF37] text-[#070605] shadow-[0_4px_15px_rgba(212,175,55,0.25)]'
              : 'bg-[#120F0D] text-zinc-400 hover:text-white border border-white/[0.06]'
          }`}
        >
          All Items ({items.length})
        </button>
        {Object.entries(categoryLabels).map(([catKey, catLabel]) => {
          const count = items.filter((i) => i.category === catKey).length;
          return (
            <button
              key={catKey}
              type="button"
              onClick={() => setSelectedCategory(catKey)}
              className={`px-4 py-2 rounded-xl font-mono text-[11px] uppercase tracking-wider font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === catKey
                  ? 'bg-[#D4AF37] text-[#070605] shadow-[0_4px_15px_rgba(212,175,55,0.25)]'
                  : 'bg-[#120F0D] text-zinc-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              {catLabel} ({count})
            </button>
          );
        })}
      </div>

      {/* MENU ITEMS DISPLAY */}
      {isLoading ? (
        <div className="py-20 text-center text-zinc-500 font-mono text-xs">Synchronizing catalog...</div>
      ) : filteredItems.length === 0 ? (
        <div className="p-1.5 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06]">
          <div className="py-20 text-center rounded-[calc(2rem-0.375rem)] bg-[#120F0D] flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl mb-2 text-zinc-600">menu_book</span>
            <p className="font-serif font-bold text-base text-white">No dishes found</p>
            <p className="text-xs text-zinc-500 mt-1">Adjust search parameters or category filter.</p>
          </div>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS VIEW (< md) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredItems.map((item) => {
              let imgUrl = '/images/hero-bar.webp';
              if (item.image) {
                if (typeof item.image === 'string') {
                  imgUrl = item.image;
                } else if (urlFor) {
                  try {
                    imgUrl = urlFor(item.image).width(120).height(120).url();
                  } catch {
                    // fallback
                  }
                }
              }

              return (
                <div
                  key={item.id}
                  className={`p-1 rounded-2xl border transition-all ${
                    item.available
                      ? 'bg-gradient-to-b from-white/[0.08] to-white/[0.02] border-white/[0.08]'
                      : 'bg-white/[0.02] border-rose-500/20 opacity-75'
                  }`}
                >
                  <div className="p-4 rounded-[calc(1rem-0.125rem)] bg-[#120F0D] flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <img
                        src={imgUrl}
                        alt={item.name}
                        className="w-14 h-14 rounded-xl object-cover border border-white/[0.1] shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-white text-sm truncate">{item.name}</p>
                          <span className="font-mono font-bold text-[#D4AF37] text-sm shrink-0 ml-2">
                            {formatPrice(item.price)}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">{item.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                              item.diet === 'veg'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : item.diet === 'vegan'
                                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {item.diet}
                          </span>
                          <span className="text-[10px] text-zinc-500 truncate">
                            {categoryLabels[item.category] || item.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Action Controls */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => handleToggleAvailability(item.id, item.name)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${
                          item.available
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.available ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                          }`}
                        />
                        <span>{item.available ? 'In Stock (Active)' : '86\'d (Sold Out)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] text-xs font-semibold cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP TABLE VIEW (>= md) */}
          <div className="hidden md:block p-1.5 rounded-[2rem] bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.06] shadow-2xl overflow-hidden">
            <div className="rounded-[calc(2rem-0.375rem)] bg-[#120F0D] overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02] text-zinc-400 text-[10px] font-mono uppercase tracking-[0.16em]">
                    <th className="py-4 px-6 font-bold">Dish & Description</th>
                    <th className="py-4 px-4 font-bold">Category</th>
                    <th className="py-4 px-4 font-bold">Diet</th>
                    <th className="py-4 px-4 font-bold">Price</th>
                    <th className="py-4 px-4 font-bold">Availability State</th>
                    <th className="py-4 px-6 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredItems.map((item) => {
                    let imgUrl = '/images/hero-bar.webp';
                    if (item.image) {
                      if (typeof item.image === 'string') {
                        imgUrl = item.image;
                      } else if (urlFor) {
                        try {
                          imgUrl = urlFor(item.image).width(120).height(120).url();
                        } catch {
                          // fallback
                        }
                      }
                    }

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-white/[0.03] transition-colors ${
                          !item.available ? 'opacity-60 bg-rose-950/[0.04]' : ''
                        }`}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3.5">
                            <img
                              src={imgUrl}
                              alt={item.name}
                              className="w-11 h-11 rounded-xl object-cover border border-white/[0.08] shrink-0"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-white flex items-center gap-2">
                                <span className="text-sm">{item.name}</span>
                                {item.tag && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 font-mono uppercase tracking-wider">
                                    {item.tag}
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-zinc-400 truncate max-w-sm mt-0.5">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-zinc-400 font-mono text-[11px]">
                          {categoryLabels[item.category] || item.category}
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
                            {item.diet}
                          </span>
                        </td>

                        <td className="py-4 px-4 font-mono font-bold text-white text-sm">
                          {formatPrice(item.price)}
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
                            <span>{item.available ? 'In Stock (Live)' : '86\'d (Sold Out)'}</span>
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
        </>
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
                      {Object.entries(categoryLabels).map(([catKey, catLabel]) => (
                        <option key={catKey} value={catKey} className="bg-[#120F0D] text-white">
                          {catLabel}
                        </option>
                      ))}
                    </select>
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

                <div className="pt-4 flex gap-3">
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
