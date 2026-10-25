import type { TaxCategory } from './tax';

export interface MenuCategoryTranslations {
  [languageCode: string]: {
    name?: string;
  };
}

export interface MenuItemTranslations {
  [languageCode: string]: {
    name?: string;
    description?: string;
    tasting_notes?: string;
    pairing?: string;
  };
}

export interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
  icon?: string;
  translations?: MenuCategoryTranslations;
  created_at?: string;
  updated_at?: string;
}

export interface MenuItem {
  id: string;
  category_id?: string;
  category?: string; // Backwards-compatible alias for category_id
  name: string;
  description: string;
  price: number;
  diet?: string;
  image_url?: string | null;
  image?: string; // Backwards-compatible alias for image_url
  popular?: boolean;
  available?: boolean;
  sort_order?: number;
  tag?: string | null;
  allergens?: string[];
  stock_count?: number | null;
  tax_category?: TaxCategory;
  created_at?: string;
  updated_at?: string;
  tasting_notes?: string;
  pairing?: string;
  translations?: MenuItemTranslations;
}

export interface EditableMenuItemInput {
  id?: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  diet?: 'veg' | 'nv' | 'vegan' | 'all' | string;
  image_url?: string;
  popular?: boolean;
  available?: boolean;
  sort_order?: number;
  allergens?: string[];
  stock_count?: number | null;
  tax_category?: TaxCategory;
  translations?: MenuItemTranslations;
}
