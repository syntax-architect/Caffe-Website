export interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
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
  created_at?: string;
  updated_at?: string;
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
}
