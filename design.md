---
name: Cosmic Amber
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#44474d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#75777e'
  outline-variant: '#c5c6cd'
  surface-tint: '#515f78'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#0d1c32'
  on-primary-container: '#76849f'
  inverse-primary: '#b9c7e4'
  secondary: '#7f5700'
  on-secondary: '#ffffff'
  secondary-container: '#ffb204'
  on-secondary-container: '#6a4800'
  tertiary: '#705d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c9a900'
  on-tertiary-container: '#4c3f00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#b9c7e4'
  on-primary-fixed: '#0d1c32'
  on-primary-fixed-variant: '#39475f'
  secondary-fixed: '#ffdead'
  secondary-fixed-dim: '#ffba3c'
  on-secondary-fixed: '#281900'
  on-secondary-fixed-variant: '#604100'
  tertiary-fixed: '#ffe16d'
  tertiary-fixed-dim: '#e9c400'
  on-tertiary-fixed: '#221b00'
  on-tertiary-fixed-variant: '#544600'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  h1:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  h2:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  h3:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
  mono-data:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 24px
  margin-page: 40px
  sidebar-width: 280px
  header-height: 72px
---

## Brand & Style

This design system establishes a high-tech, exploratory aesthetic that bridges the gap between scientific precision and celestial wonder. It is designed for complex data environments, aerospace interfaces, or advanced research tools where clarity is paramount but a sense of discovery is encouraged.

The style utilizes a **High-Tech Minimalism** approach, characterized by a light-mode canvas punctuated by high-contrast, structural dark components. It borrows elements of **Glassmorphism**—specifically for floating panels and navigational overlays—to maintain a sense of layered depth. The emotional response is one of institutional trust mixed with the excitement of frontier exploration.

## Colors

The palette creates a striking structural contrast. The primary foundation is built on **Midnight Blue** and **Deep Navy**, reserved for persistent structural elements like sidebars, global headers, and modal backdrops. This provides a "command center" feel even within a light-mode system.

The interactive soul of the UI resides in the **Stellar Amber** and **Golden Yellow** accents. These colors are used exclusively for primary actions, progression indicators, and critical data highlights. Backgrounds for content areas remain a crisp, neutral white or ultra-light slate to ensure maximum readability and a clean, technical feel.

## Typography

The typography utilizes **Space Grotesk** across all levels to reinforce the technical and futuristic narrative. The font's geometric quirks provide a distinct character that feels both engineered and human.

Headlines feature tight letter-spacing and bold weights to anchor sections. Body text is optimized for legibility with generous line heights. A specific "Label-Caps" style is used for metadata and small headers to mimic technical instrumentation. Numeric data should prioritize medium weights to ensure clarity against both light and dark backgrounds.

## Layout & Spacing

The design system employs a **Fixed-Fluid Hybrid** grid. Sidebars and headers are fixed structural constants, while the main content area utilizes a 12-column fluid grid with a maximum cap to maintain readability.

The spacing rhythm is strictly based on an **8px base unit**, creating a mathematical harmony across the UI. Large "Exploratory" margins (40px+) are used around key content blocks to simulate the vastness of space, preventing the high-density data from feeling claustrophobic. Gutters are kept wide (24px) to separate technical modules clearly.

## Elevation & Depth

Depth is achieved through **Tonal Layering** and **Glassmorphism**.

1. **Structural Base:** The background is the lowest level (Slate-100).
2. **Content Cards:** White surfaces with a very soft, ambient navy-tinted shadow (0px 4px 20px rgba(10, 25, 47, 0.05)).
3. **Command Layers:** Sidebars and headers use solid Deep Navy, appearing to "sink" or "frame" the light content.
4. **Floating Elements:** Modals and dropdowns use a "Frosted Navy" glass effect—semi-transparent Deep Navy with a 20px backdrop blur and a 1px inner border in a lighter blue to define the edge.

## Shapes

The system uses **Round Eight** (Level 2) logic. This ensures that while the aesthetic is "high-tech," it avoids being cold or aggressive.

Standard components like buttons and input fields feature a 0.5rem (8px) corner radius. Larger containers, such as dashboard cards and floating panels, utilize 1rem (16px) for a more modern, sophisticated feel. Interactive "pills" for status indicators use a full radius to contrast against the more structural rectangular modules.

## Components

### Buttons
- **Primary:** Solid Amber-500 with Navy-800 text. Sharp focus states with a 2px outer glow.
- **Secondary:** Transparent with a 2px Navy-800 border and Navy-800 text.
- **Ghost:** Navy-800 text with no border; background appears as Slate-100 on hover.

### Inputs & Form Elements
- **Fields:** White background, 1px Slate-300 border. On focus, the border turns Amber-500 with a subtle glow.
- **Checkboxes:** Square with 4px rounded corners. When active, solid Amber-500 with a white checkmark.

### Navigation (Structural)
- **Sidebar:** Deep Navy background. Icons in light blue-grey, turning Amber-500 on active state. A vertical amber line indicates the current page selection.
- **Header:** Deep Navy with a 1px bottom border in Navy-700.

### Data & Feedback
- **Progression Bars:** Background is Navy-700; the progress fill is a gradient from Golden Yellow to Amber-500.
- **Chips:** Small, pill-shaped tags. High-priority chips use Amber backgrounds; neutral chips use Navy-800 with white text.
- **Cards:** White base, 1rem corner radius, with a subtle 1px border in Slate-100 to define edges on the light background.

### Exploratory Elements
- **Data Visualizations:** Use the amber/gold palette for primary metrics, contrasted against navy grid lines.
- **Tooltips:** Midnight Blue backgrounds with white Space Grotesk labels, providing a high-contrast popover effect.
