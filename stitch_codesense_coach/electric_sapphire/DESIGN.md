---
name: Electric Sapphire
colors:
  surface: '#0f1418'
  surface-dim: '#0f1418'
  surface-bright: '#353a3e'
  surface-container-lowest: '#0a0f13'
  surface-container-low: '#171c20'
  surface-container: '#1b2024'
  surface-container-high: '#252b2f'
  surface-container-highest: '#30353a'
  on-surface: '#dee3e9'
  on-surface-variant: '#bec8d2'
  inverse-surface: '#dee3e9'
  inverse-on-surface: '#2c3135'
  outline: '#88929b'
  outline-variant: '#3e4850'
  surface-tint: '#89ceff'
  primary: '#89ceff'
  on-primary: '#00344d'
  primary-container: '#0ea5e9'
  on-primary-container: '#003751'
  inverse-primary: '#006591'
  secondary: '#d0bcff'
  on-secondary: '#3c0091'
  secondary-container: '#571bc1'
  on-secondary-container: '#c4abff'
  tertiary: '#b9c8de'
  on-tertiary: '#233143'
  tertiary-container: '#8e9db2'
  on-tertiary-container: '#263446'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c9e6ff'
  primary-fixed-dim: '#89ceff'
  on-primary-fixed: '#001e2f'
  on-primary-fixed-variant: '#004c6e'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#d5e4fa'
  tertiary-fixed-dim: '#b9c8de'
  on-tertiary-fixed: '#0e1c2d'
  on-tertiary-fixed-variant: '#3a485a'
  background: '#0f1418'
  on-background: '#dee3e9'
  surface-variant: '#30353a'
  sapphire-deep: '#051424'
  electric-blue: '#0ea5e9'
  soft-violet: '#a78bfa'
  glow-blue: rgba(14, 165, 233, 0.15)
  surface-elevated: '#0d1e33'
typography:
  display:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.7'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.7'
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 0.5rem
  sm: 1rem
  md: 2rem
  lg: 4rem
  xl: 8rem
  gutter: 2rem
  margin: 2.5rem
---

## Brand & Style

The design system projects a "Modern Engineering" aesthetic that is both high-precision and high-energy. It moves away from sterile, industrial themes toward a "vibrant and cool" personality that feels helpful and supercharged. The target audience consists of developers and engineers who value technical density but appreciate a UI that feels alive and encouraging.

The style is a hybrid of **Glassmorphism** and **High-Contrast / Bold** modernism. It uses deep sapphire foundations to maintain focus, punctuated by electric blue and soft violet accents that "glow" against the dark background. The personality is expressed through expressive emojis (replacing standard system icons), smooth motion, and generous whitespace, creating an interface that feels like a premium, futuristic command center.

## Colors

The palette is anchored by **Deep Sapphire (#051424)**, providing a sophisticated, low-fatigue base for long engineering sessions. 

- **Primary (Electric Blue):** Used for critical actions, interactive states, and data highlights. It is the primary source of "energy" in the UI.
- **Secondary (Soft Violet):** Used for secondary accents, supplementary data series, and to provide a "cool" gradient transition from the primary blue.
- **Surface Strategy:** Layers are built using incremental lightness shifts from the deep sapphire base. 
- **Accents:** Use gradients blending Electric Blue and Soft Violet for high-impact elements like primary buttons and progress indicators to create a sense of depth and vibrancy.

## Typography

This design system uses **Geist** for its razor-sharp terminal aesthetic and **JetBrains Mono** for technical data.

- **Scale & Contrast:** Headlines use tight letter-spacing and heavy weights to command attention against the generous whitespace.
- **Readability:** Body text line-heights are increased (1.6 to 1.7) to offset the high-contrast dark mode environment and prevent "halatting" (visual blurring of white text on dark backgrounds).
- **Expressive Emojis:** System icons are frequently replaced by full-color emojis to inject personality. Emojis should be sized 1.2x the line height of the accompanying text to ensure they feel prominent and "super cool."

## Layout & Spacing

The layout philosophy emphasizes **Generous Whitespace** to contrast the technical density of engineering data. A fluid 12-column grid is used for desktop environments.

- **Desktop (1280px+):** 12 columns, 32px gutters, 40px margins.
- **Tablet (768px - 1279px):** 8 columns, 24px gutters, 32px margins.
- **Mobile (<767px):** 4 columns, 16px gutters, 20px margins.

Vertical rhythm is strictly controlled by a 4px base unit. Sections are separated by large gaps (`lg` or `xl` tokens) to create a sense of breathing room and modern, "uncluttered" engineering.

## Elevation & Depth

Hierarchy is established through **Backdrop Blurs** and **Subtle Glows** rather than heavy shadows.

- **Glassmorphism:** Secondary surfaces use a 70% opacity sapphire fill with a high-intensity backdrop blur (24px).
- **Glow Effects:** Interactive elements and data curves utilize a soft outer glow (drop-shadow with the primary color at 15-20% opacity) to simulate a light-emitting interface.
- **Borders:** Use 1px "inner-glow" borders (`rgba(14, 165, 233, 0.2)`) to define container edges without adding visual bulk.
- **Tonal Stacking:** Higher elevation levels are indicated by lighter sapphire tints, moving from the base (#051424) to elevated containers (#0d1e33).

## Shapes

The shape language balance technical precision with approachable modernism. 

- **Primary Radius:** A consistent `0.5rem` (8px) is applied to all cards and inputs.
- **Interactive Elements:** Buttons and tags use `rounded-lg` (1rem) to feel more "friendly" and tactile.
- **Graph Curves:** Data visualizations must never use sharp angles; utilize Catmull-Rom or Cubic Bezier smoothing for all line charts to reinforce the "vibrant and cool" aesthetic.

## Components

- **Buttons:** Primary buttons feature a diagonal gradient from Electric Blue to Soft Violet. On hover, the button’s glow effect intensifies.
- **Cards:** Dashboard widgets use the glassmorphic style with a subtle `1px` top-border glow.
- **Input Fields:** Sapphire-deep background with a `1px` Soft Violet border that transitions to a thick Electric Blue glow on focus.
- **Data Visualization:** Charts use smooth curves and a gradient fill (Electric Blue to Transparent). Data points should have a `subtle glow` effect when hovered.
- **Chips & Tags:** Use `label-sm` font. Backgrounds are low-opacity versions of the accent colors (e.g., 10% Soft Violet) with high-saturation text.
- **Status Indicators:** Replace traditional status icons with themed emojis (e.g., 🚀 for Deployment, ✅ for Success, ⚠️ for Warning).