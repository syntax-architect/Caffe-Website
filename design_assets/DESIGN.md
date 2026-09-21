---
name: Velvet & Ember Lounge
colors:
  surface: '#10131a'
  surface-dim: '#10131a'
  surface-bright: '#363940'
  surface-container-lowest: '#0b0e14'
  surface-container-low: '#191c22'
  surface-container: '#1d2026'
  surface-container-high: '#272a31'
  surface-container-highest: '#32353c'
  on-surface: '#e1e2eb'
  on-surface-variant: '#e0c0b1'
  inverse-surface: '#e1e2eb'
  inverse-on-surface: '#2e3037'
  outline: '#a78b7d'
  outline-variant: '#584237'
  surface-tint: '#ffb690'
  primary: '#ffb690'
  on-primary: '#552100'
  primary-container: '#f97316'
  on-primary-container: '#582200'
  inverse-primary: '#9d4300'
  secondary: '#b4c5ff'
  on-secondary: '#002a78'
  secondary-container: '#0053db'
  on-secondary-container: '#cdd7ff'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#d78900'
  on-tertiary-container: '#492c00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbca'
  primary-fixed-dim: '#ffb690'
  on-primary-fixed: '#341100'
  on-primary-fixed-variant: '#783200'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#10131a'
  on-background: '#e1e2eb'
  surface-variant: '#32353c'
typography:
  display-lg:
    fontFamily: Outfit
    fontSize: 56px
    fontWeight: '600'
    lineHeight: 64px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Outfit
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Outfit
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Outfit
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Outfit
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Outfit
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Outfit
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Outfit
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system embodies a luxurious, nocturnal lounge ambiance tailored for an upscale culinary destination. It balances the intimate comfort of a dimly lit, velvet-draped bistro with the refined polish of contemporary haute gastronomy. 

The aesthetic is grounded in **Atmospheric Glassmorphism and Luminescent Depth**. The interface relies on deep, velvety dark surfaces that absorb ambient light, punctuated by selective, tactile glows of burnt orange and radiant amber that evoke candlelit mahogany tables and artisanal roasts. Frosted glass containers, hair-thin glowing strokes, and polished metallic edge treatments provide an editorial, high-touch luxury feel. 

The experience evokes quiet confidence, sensory indulgence, and modern prestige, positioning digital ordering and table reservation as extensions of an elite hospitality experience.

## Colors

The palette mirrors a curated nighttime cafe lounge: deep shadows, rich sapphire textiles, and warm incandescent light.

- **Primary (`#F97316` / `#EA580C`)**: Burnt Orange. Represents embers, roasted espresso crema, and warm hearth light. Used for primary calls to action, active selections, price tags, and core interactive states.
- **Secondary (`#2563EB` / `#1E3A8A`)**: Sapphire Velvet. Evokes deep midnight lounge seating and twilight moods. Used for ambient backdrop glows, culinary prestige tags, active tab track fills, and secondary controls.
- **Tertiary (`#F59E0B`)**: Warm Amber. Denotes signature chef recommendations, star ratings, specialty badges, and celebratory cues.
- **Neutral (`#0B0E14`)**: Midnight Charcoal canvas. Complemented by `#121824` (Slate Navy) for surface cards, `#1A2234` for elevated dialogs, and low-opacity translucent whites (`rgba(255, 255, 255, 0.05)` to `0.12`) for glass panels.

Text layers utilize Crisp Pure White (`#F8FAFC`) for primary headers, Warm Starlight (`#94A3B8`) for secondary body descriptions, and Muted Dusk (`#64748B`) for tertiary meta-information.

## Typography

Typography balances geometric modernity with pristine legibility. **Outfit** serves as the display and accent face, lending crisp modern sophistication, generous aperture, and architectural chicness to headers, category tabs, and numerical prices. **Inter** is deployed for long-form descriptions, dietary breakdowns, and transactional microcopy, guaranteeing effortless readability against dark, glassy backdrops.

Headlines employ tight tracking (`-0.01em` to `-0.02em`) for a confident editorial stance. Labels, badges, and dietary pills leverage subtle uppercase or sentence-cased tracking (`+0.02em` to `+0.06em`) to ensure legibility across micro-scales.

## Layout & Spacing

The layout is constructed on a 12-column responsive grid system for desktop and tablet, collapsing to a single or dual-column adaptive layout on mobile devices. 

- **Desktop (1200px+)**: 12 columns, 24px (`1.5rem`) gutters, and dynamic margins scaling up to a max-width container of 1320px. 
- **Tablet (768px – 1199px)**: 8 columns, 20px gutters, and 32px outer canvas margins.
- **Mobile (<768px)**: 4 columns, 16px gutters, and 20px outer canvas margins to retain edge breathing room for thumb-driven navigation.

Spacing follows an intentional rhythm prioritizing vertical generosity. Cards and dish listings use `space-lg` to create culinary prestige rather than cramped utility. Edge padding inside glass panels strictly maintains a minimum of `space-md` on mobile and `space-lg` on desktop.

## Elevation & Depth

Visual hierarchy is communicated via layered translucent planes and warm optical glows rather than harsh drop shadows.

- **Level 0 (Canvas)**: Deep `#0B0E14` base with occasional background radial gradients of muted sapphire (`rgba(30, 58, 138, 0.15)`) and faint ember amber (`rgba(234, 88, 12, 0.08)`).
- **Level 1 (Surface Cards & Lists)**: `#121824` rendered with 65% opacity and a `backdrop-filter: blur(16px)`. Border is a 1px composite stroke: `rgba(255, 255, 255, 0.08)`.
- **Level 2 (Interactive Cards & Highlights)**: Higher translucency (`rgba(18, 24, 36, 0.85)`), elevated with a soft ambient shadow: `0 12px 32px -4px rgba(0, 0, 0, 0.5)`. Hovering triggers a faint amber or sapphire edge luminance (`0 0 16px rgba(249, 115, 22, 0.2)`).
- **Level 3 (Modals, Slide-overs, Floating Cart)**: `rgba(26, 34, 52, 0.95)` with `backdrop-filter: blur(24px)`. Outer shadow: `0 24px 48px -8px rgba(0, 0, 0, 0.75)`, framed by a delicate dual-tone top border highlight of `rgba(249, 115, 22, 0.3)`.

## Shapes

The design uses balanced, modern curvature (`roundedness: 2`). Standard structural surfaces, cards, and input fields feature an 8px (`0.5rem`) radius, expanding to 16px (`1rem`) on outer feature cards and modals. 

Pill shapes (`rounded-full` / 9999px) are strictly reserved for functional markers: Veg/Non-Veg indicators, promotional micro-tags, filter pills, and circular floating action icons. This distinction ensures users immediately distinguish informational status pills from structural containers.

## Components

### Buttons
- **Primary Action**: Burnt orange linear gradient (`from #EA580C to #F97316`), white Outfit semi-bold typography, subtle amber inner highlight (`inset 0 1px 0 rgba(255,255,255,0.2)`), and a warm drop glow on hover (`0 4px 20px rgba(249, 115, 22, 0.35)`). Height: 48px desktop / 44px mobile.
- **Secondary Action**: Translucent dark sapphire (`rgba(37, 99, 235, 0.12)`), framed with a 1px sapphire border (`rgba(37, 99, 235, 0.4)`), text rendered in `#60A5FA`.
- **Ghost/Text**: Frameless with Outfit medium, transitioning from `#94A3B8` to `#F8FAFC` on hover with an expanding amber underline dot.

### Dietary Badges (Veg / Non-Veg / Chef Special)
- Compact pill-shaped modules. 
- **Veg**: Translucent emerald green fill (`rgba(16, 185, 129, 0.1)`), 1px border (`#10B981`), containing a green dot icon and uppercase label in `label-sm`.
- **Non-Veg**: Translucent ruby/crimson fill (`rgba(239, 68, 68, 0.1)`), 1px border (`#EF4444`), containing a crimson triangle marker.
- **Chef's Signature**: Translucent amber fill (`rgba(245, 158, 11, 0.15)`), border (`#F59E0B`), typography in `#FBBF24`.

### Navigation Tabs
- Segmented pill track set against `rgba(18, 24, 36, 0.7)` with `backdrop-filter: blur(12px)`.
- Active tab features an illuminated background pill (`#1E3A8A` fading to `#2563EB`) with a crisp white label and subtle sapphire underglow. Inactive tabs display `#94A3B8` with smooth transitions.

### Cards (Menu Items & Lounge Spaces)
- Enclosed in glassmorphic containers with 16px corner radii and 1px borders (`rgba(255, 255, 255, 0.08)`).
- Food & beverage photography occupies the top region with an overlaid subtle dark gradient vignette fading down into `#121824`.
- Pricing is rendered in Outfit Semi-bold in Warm Amber (`#F59E0B`).

### Form Inputs & Selectors
- Background: `#0E131D` inset; border: 1px `rgba(255, 255, 255, 0.12)`.
- Focus state: Border transitions to Burnt Orange (`#F97316`) accompanied by an ambient ring glow (`box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15)`). Placeholders sit in `#64748B`.

### Reservation Slot Pickers
- Time and table selectors use segmented interactive tiles. Available slots display subtle borders and slate surfaces; selected slots illuminate in rich sapphire blue (`#2563EB`) with crisp white time typography and an amber indicator badge.