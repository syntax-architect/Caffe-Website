import React, { useState, useEffect, useMemo } from 'react';
import { client, urlFor } from '../../lib/sanityClient';
import { menuData } from '../../data/menu';
import { useNotification } from '../../hooks/useNotification';

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

  const [items, setItems] = useState<EditableMenuItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'nv'>('all');

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

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-on-surface">Restaurant Menu Management</h2>
          <p className="text-xs text-outline mt-0.5">
            Manage food & beverage catalog, instant 86'd sold-out status, and pricing.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="py-2.5 px-4 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-2 shadow"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Add Menu Item
        </button>
      </div>

      {/* Security Architectural Notice (Section 9 Requirement) */}
      <div className="p-4 rounded-2xl bg-surface-container border border-primary/20 text-xs text-outline leading-relaxed flex items-start gap-3">
        <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">verified_user</span>
        <div>
          <p className="font-semibold text-primary mb-0.5">Sanity Write-Path Security</p>
          <p className="text-[11px] text-outline/90">
            In strict compliance with restaurant security architecture, private Sanity write credentials are never exposed in browser bundles.
            Availability toggles operate instantly during active dining service, while permanent CMS schema mutations are dispatched through verified backend functions.
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search menu items, ingredients, or descriptions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant/60 rounded-xl pl-10 pr-4 py-2 text-xs text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Diet Filter Pills */}
          <div className="bg-surface-container p-1 rounded-xl border border-outline-variant/60 flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setDietFilter('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                dietFilter === 'all' ? 'bg-primary text-on-primary' : 'text-outline hover:text-on-surface'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setDietFilter('veg')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                dietFilter === 'veg' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Veg
            </button>
            <button
              type="button"
              onClick={() => setDietFilter('nv')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                dietFilter === 'nv' ? 'bg-red-600 text-white' : 'text-red-400 hover:text-red-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              Non-Veg
            </button>
          </div>

          <button
            type="button"
            onClick={handleReloadMenu}
            className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-outline hover:text-on-surface transition-colors"
            title="Reload Menu"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-outline-variant/30 scrollbar-none text-xs">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3.5 py-1.5 rounded-full font-semibold whitespace-nowrap transition-colors ${
            selectedCategory === 'all'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'text-outline hover:text-on-surface hover:bg-surface-container'
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
              className={`px-3.5 py-1.5 rounded-full font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === catKey
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-outline hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              {catLabel} ({count})
            </button>
          );
        })}
      </div>

      {/* Menu Items Table / Grid */}
      <div className="bg-surface-container border border-outline-variant/40 rounded-3xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 text-center text-outline text-xs">Loading menu items...</div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center text-outline text-xs flex flex-col items-center">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-40">menu_book</span>
            <p className="font-semibold text-sm text-on-surface">No menu items match your search</p>
            <p className="text-[11px] mt-1">Try clearing filters or search terms.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-outline-variant/30 bg-surface-container-high/40 text-outline text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-5 font-semibold">Dish</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Diet</th>
                  <th className="py-3 px-4 font-semibold">Price</th>
                  <th className="py-3 px-4 font-semibold">Stock State</th>
                  <th className="py-3 px-5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
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
                    <tr key={item.id} className="hover:bg-surface-container-high/60 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <img
                            src={imgUrl}
                            alt={item.name}
                            className="w-10 h-10 rounded-xl object-cover border border-outline-variant/40 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-on-surface truncate flex items-center gap-1.5">
                              {item.name}
                              {item.tag && (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-primary/15 text-primary border border-primary/30 font-sans font-semibold">
                                  {item.tag}
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-outline truncate max-w-xs">{item.description}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-outline font-medium">
                        {categoryLabels[item.category] || item.category}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            item.diet === 'veg'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : item.diet === 'vegan'
                              ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                              : 'bg-red-500/10 text-red-400 border-red-500/30'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {item.diet}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-bold text-on-surface font-mono">
                        ₹{item.price}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(item.id, item.name)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                            item.available
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25'
                          }`}
                        >
                          {item.available ? 'In Stock' : '86\'d (Sold Out)'}
                        </button>
                      </td>

                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/40 text-[11px] font-semibold text-primary transition-colors"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Item Modal */}
      {(isAddingItem || editingItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => {
              setIsAddingItem(false);
              setEditingItem(null);
            }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-lg bg-surface-container-high border border-outline-variant/60 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-serif font-bold text-on-surface mb-1">
              {editingItem ? `Edit "${editingItem.name}"` : 'Add New Menu Item'}
            </h3>
            <p className="text-xs text-outline mb-6">
              Update dish details, price, category, and dietary tags.
            </p>

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block uppercase font-bold tracking-wider text-outline mb-1">
                    Dish Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Truffle Mushroom Pizza"
                    className="w-full bg-surface-container border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary font-medium"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block uppercase font-bold tracking-wider text-outline mb-1">
                    Price (₹ INR)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full bg-surface-container border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface font-mono font-bold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block uppercase font-bold tracking-wider text-outline mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    {Object.entries(categoryLabels).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block uppercase font-bold tracking-wider text-outline mb-1">
                    Dietary Classification
                  </label>
                  <select
                    value={formDiet}
                    onChange={(e) => setFormDiet(e.target.value as any)}
                    className="w-full bg-surface-container border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="veg">Vegetarian</option>
                    <option value="nv">Non-Vegetarian</option>
                    <option value="vegan">Vegan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block uppercase font-bold tracking-wider text-outline mb-1">
                  Description & Ingredients
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe flavors, preparation method, and allergen notes..."
                  className="w-full bg-surface-container border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block uppercase font-bold tracking-wider text-outline mb-1">
                    Promotional Tag (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chef's Pick, Bestseller"
                    value={formTag}
                    onChange={(e) => setFormTag(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant/60 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    id="modal-available"
                    type="checkbox"
                    checked={formAvailable}
                    onChange={(e) => setFormAvailable(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-outline-variant focus:ring-0 bg-surface-container"
                  />
                  <label htmlFor="modal-available" className="text-xs font-semibold text-on-surface cursor-pointer">
                    Available for Order (In Stock)
                  </label>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingItem(false);
                    setEditingItem(null);
                  }}
                  className="flex-1 py-2.5 rounded-full bg-surface-container hover:bg-surface-container-highest border border-outline-variant/40 font-semibold text-outline hover:text-on-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingItem}
                  className={`flex-1 py-2.5 rounded-full font-semibold flex items-center justify-center gap-2 transition-all shadow ${
                    isSavingItem
                      ? 'bg-primary/50 text-on-primary cursor-wait'
                      : 'bg-primary text-on-primary hover:bg-primary-hover active:scale-95'
                  }`}
                >
                  {isSavingItem ? (
                    <>
                      <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingItem ? 'Save Changes' : 'Add to Menu'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuManagement;
