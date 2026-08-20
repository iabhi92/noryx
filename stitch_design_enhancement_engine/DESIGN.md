---
name: Midnight Mono
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1c'
  surface-container: '#202020'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c7c7'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#303030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c8c6c5'
  primary: '#c8c6c5'
  on-primary: '#313030'
  primary-container: '#121212'
  on-primary-container: '#7e7d7d'
  inverse-primary: '#5f5e5e'
  secondary: '#c0c1ff'
  on-secondary: '#1000a9'
  secondary-container: '#3131c0'
  on-secondary-container: '#b0b2ff'
  tertiary: '#c6c6c7'
  on-tertiary: '#2f3131'
  tertiary-container: '#101213'
  on-tertiary-container: '#7c7d7e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 16px
  margin: 24px
---

## Brand & Style
The design system is a "pro-tool" environment tailored for developers and technical power users. It prioritizes information density, clarity, and precision over decorative flair. The aesthetic is a refined evolution of **Minimalism** blended with **Corporate Modern** sensibilities, stripped of generic sci-fi tropes like heavy glows or aggressive gradients.

The UI should evoke a sense of calm focus—a "flow state" companion. It relies on structural integrity, sharp definition, and purposeful whitespace to organize complex data. The emotional response is one of reliability, high performance, and professional-grade utility.

## Colors
The palette is rooted in a high-contrast dark mode to reduce eye strain during extended technical work. 

- **Primary Background**: Use `#121212` for the main canvas.
- **Surface/Neutral**: Use `#1E1E1E` for containers, sidebars, and elevated surfaces.
- **Accent**: A precise Indigo (`#6366F1`) is used sparingly for primary actions, focus states, and progress indicators. 
- **Typography**: Pure white (`#FFFFFF`) for primary headers, a muted gray (`#A1A1AA`) for secondary text, and a deep slate (`#3F3F46`) for disabled states or subtle borders.

Avoid any "vibrant" or "neon" variations. Colors must remain grounded and utilitarian.

## Typography
Typography is the primary driver of the visual hierarchy. **Geist** provides a clean, Swiss-inspired sans-serif foundation for UI elements and prose, while **JetBrains Mono** is utilized for data points, labels, and code blocks to maintain a technical rigor.

Use `label-sm` in uppercase for section headers or small metadata to create a distinct "instrument panel" feel. All code-related content must use `code-md`.

## Layout & Spacing
The design system employs a **fixed grid** philosophy with a strictly modular 4px base unit. 

- **Desktop**: 12-column grid with a maximum content width of 1440px. 16px gutters and 24px side margins.
- **Tablet**: 8-column grid with 16px margins.
- **Mobile**: 4-column grid with 16px margins.

Layouts should favor vertical stacks and clear horizontal divisions. Use "Dividers" rather than "Gaps" to define large sections of the application, maintaining a structured, architectural feel.

## Elevation & Depth
In the absence of shadows and glows, depth is communicated through **Tonal Layers** and **Subtle Translucency**.

1. **Surface Level 0**: Base background (`#121212`).
2. **Surface Level 1**: Secondary containers and sidebars (`#1E1E1E`).
3. **Surface Level 2**: Cards, modals, and popovers (`#27272A`).

Use **low-contrast outlines** (1px solid `#3F3F46`) to define boundaries. For floating elements like menus, use a `backdrop-filter: blur(12px)` with a semi-transparent surface (`rgba(30, 30, 30, 0.8)`) to suggest a physical stack without relying on heavy drop shadows.

## Shapes
Shapes are disciplined and "Soft" (0.25rem). This slight rounding prevents the UI from feeling aggressive or "Brutalist" while maintaining the precision of a professional tool. 

- **Standard Elements**: 4px (0.25rem) radius for buttons, inputs, and small cards.
- **Large Containers**: 8px (0.5rem) radius for main content areas or modals.
- **Icons**: Use linear, 2px stroke icons with square terminals to match the technical aesthetic.

## Components

### Buttons
- **Primary**: Solid Accent color (`#6366F1`) with white text. No gradients.
- **Secondary**: Ghost style with `#3F3F46` border and white text.
- **Ghost**: No border, transitions to `#1E1E1E` background on hover.

### Input Fields
- **Default**: 1px solid border (`#3F3F46`), background (`#121212`). 
- **Focus**: Border changes to Accent (`#6366F1`) with a 0px spread, 2px thick outer ring.
- **Monospace text**: Use JetBrains Mono for input values.

### Chips & Tags
- Rectangular with 4px radius. Use a dark fill (`#27272A`) and subtle white border. Use mono font for the label.

### Cards
- No shadows. Use a 1px solid border (`#27272A`) and a subtle background shift (`#1E1E1E`) to differentiate from the base.

### Lists & Tables
- High-density. Horizontal separators only (`1px solid #1E1E1E`). Hover states should use a subtle gray highlight (`rgba(255, 255, 255, 0.03)`).