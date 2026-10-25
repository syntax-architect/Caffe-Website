/**
 * Fixed Curated List of Category Icons for Restaurant Operations
 * Restricted picker list to ensure 100% font subset coverage with zero broken glyphs.
 */
export const CATEGORY_PICKER_ICONS = [
  'restaurant_menu',
  'restaurant',
  'local_pizza',
  'ramen_dining',
  'skillet',
  'local_cafe',
  'soup_kitchen',
  'bakery_dining',
  'fastfood',
  'lunch_dining',
  'dinner_dining',
  'cake',
  'icecream',
  'local_bar',
  'wine_bar',
  'liquor',
  'local_drink',
  'emoji_food_beverage',
  'set_meal',
  'takeout_dining',
  'kebab_dining',
  'bento',
  'tapas',
  'egg',
  'breakfast_dining',
  'brunch_dining',
  'flatware',
  'table_restaurant',
  'sports_bar',
  'coffee',
] as const;

export type CategoryPickerIcon = (typeof CATEGORY_PICKER_ICONS)[number];

export const DEFAULT_CATEGORY_ICON: CategoryPickerIcon = 'restaurant_menu';

/**
 * Maps any arbitrary category name or DB icon to an authoritative icon from the fixed picker list.
 */
export function getCategoryIcon(categoryName: string, customIcon?: string): CategoryPickerIcon {
  if (customIcon && (CATEGORY_PICKER_ICONS as readonly string[]).includes(customIcon)) {
    return customIcon as CategoryPickerIcon;
  }
  const cat = (categoryName || '').toLowerCase();
  if (cat.includes('burger') || cat.includes('pizza')) return 'local_pizza';
  if (cat.includes('starter') || cat.includes('momo') || cat.includes('dim sum') || cat.includes('noodle')) return 'ramen_dining';
  if (cat.includes('main') || cat.includes('platter') || cat.includes('tandoor') || cat.includes('sizzler')) return 'skillet';
  if (cat.includes('sip') || cat.includes('dessert') || cat.includes('coffee') || cat.includes('sweet') || cat.includes('beverage')) return 'local_cafe';
  if (cat.includes('soup') || cat.includes('salad') || cat.includes('bowl')) return 'soup_kitchen';
  if (cat.includes('bar') || cat.includes('cocktail') || cat.includes('spirit') || cat.includes('liquor')) return 'local_bar';
  if (cat.includes('wine')) return 'wine_bar';
  if (cat.includes('bakery') || cat.includes('bread') || cat.includes('pastry')) return 'bakery_dining';
  if (cat.includes('breakfast')) return 'breakfast_dining';
  return 'restaurant_menu';
}
