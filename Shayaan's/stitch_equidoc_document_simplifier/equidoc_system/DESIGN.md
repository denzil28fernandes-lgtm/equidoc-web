---
name: EquiDoc System
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf3'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d5e3fc'
  on-surface: '#0d1c2e'
  on-surface-variant: '#45464d'
  inverse-surface: '#233144'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#191c1e'
  on-tertiary-container: '#818486'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f8f9ff'
  on-background: '#0d1c2e'
  surface-variant: '#d5e3fc'
typography:
  headline-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 24px
    fontWeight: '800'
    lineHeight: 32px
  headline-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.05em
  interactive-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  margin-mobile: 16px
  gutter-mobile: 12px
  touch-target-min: 48px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style

The design system is engineered for workers who need immediate, reliable clarity from complex paperwork. The brand personality is that of a "Trusted Advocate"—professional and serious regarding legalities, yet approachable and helpful in its delivery. 

The visual style is **High-Utility Minimalism**. It prioritizes extreme legibility and physical ease of use over decorative flair. By stripping away heavy shadows and complex gradients, the system ensures high performance on older mobile devices and maximum visibility in challenging environments, such as outdoor construction sites or brightly lit warehouses. The emotional response should be one of "instant relief"—the feeling that a daunting document has finally been made simple and safe.

## Colors

The color palette is anchored in "Safe & Secure" tones. 

- **Primary (Deep Blue):** Used for headers, primary actions, and authoritative text to establish a foundation of trust.
- **Secondary (Soft Teal):** Used for helpful AI features, "Translate," and "Speak" functions to provide a calming, supportive contrast.
- **Backgrounds:** Use high-contrast white or off-white (#F8FAFC) to ensure text pops.
- **Semantic Colors:** These are critical. Warnings (important legal clauses) use a high-visibility amber, while errors or critical risks use a bold red. These colors must pass WCAG AAA contrast ratios against the background to ensure they are readable in direct sunlight.

## Typography

This design system utilizes **Atkinson Hyperlegible Next** across all roles. This typeface was specifically designed for maximum readability, making it the perfect choice for workers who may be viewing content on cracked screens or in low-light conditions.

The type scale is intentionally large. Body text starts at 18px for primary summaries to reduce eye strain. All interactive elements (buttons, links) use a bold weight to differentiate them from static information. Line heights are generous (1.5x) to prevent lines of text from blurring together during quick reading.

## Layout & Spacing

The layout follows a **fluid mobile-first grid**. Given the target audience, the system prioritizes "Thumb-Driven Design," placing all critical actions within easy reach of the bottom of the screen.

- **Grid:** A simple 4-column layout for mobile with 16px side margins.
- **Touch Targets:** No interactive element should be smaller than 48x48px to accommodate manual labor hands or gloved use.
- **Rhythm:** Vertical spacing uses a strict 8px baseline to maintain a clean, organized appearance that feels "stable."
- **Content Reflow:** On larger devices (tablets), the content maintains a maximum readable width of 600px, centered on the screen to prevent long line lengths that decrease comprehension.

## Elevation & Depth

To ensure high performance and visibility, this design system avoids shadows. Depth is communicated through **Tonal Layers and High-Contrast Outlines**.

- **Surface Tiers:** The base background is white. Secondary information (like a document preview) sits on a light gray (#F1F5F9) container.
- **Borders:** Instead of shadows, cards and inputs use 1px or 2px solid borders (#E2E8F0).
- **Active State:** When an element is focused or processing, the border weight increases and changes to the Primary or Secondary color.
- **Processing States:** AI processing is indicated through subtle, high-performance CSS opacity pulses rather than complex 3D animations.

## Shapes

The design system uses **Soft (0.25rem)** roundedness. This subtle rounding removes the "aggression" of sharp corners—making the app feel approachable—while maintaining a professional, structured look. 

- **Primary Buttons:** Use `rounded-lg` (0.5rem) to make them feel more tactile and "clickable."
- **Status Pills:** Use full `rounded-xl` (pill-shaped) to distinguish them from interactive buttons.
- **Input Fields:** Use standard 0.25rem rounding to align with the professional, form-based nature of document handling.

## Components

### Buttons
- **Primary:** Solid Deep Blue background with White text. Large padding (16px vertical).
- **Secondary (AI Actions):** Solid Teal background with White text. Used specifically for 'Translate' and 'Speak'.
- **Iconography:** Every major action (Photo, Translate, Speak) must pair an icon with a text label to ensure zero ambiguity.

### Cards & Summaries
- **High-Contrast Summary:** A white card with a 2px Teal left-border. This visually anchors the AI-generated "Simple Version" of a document.
- **Status Indicators:** A dedicated "Processing" bar at the top of the screen using a Teal pulse animation to show the AI is working.

### Audio Controls
- **Prominent Player:** A fixed bottom-bar component for audio playback. It features large 'Play', 'Pause', and 'Seek' buttons that are easy to hit while the user is looking at the physical document.

### Input Fields
- **Photo Upload:** A large, dashed-border container that acts as a giant button. High contrast (Deep Blue border on light gray background).
- **Forms:** Labels are always positioned above the input (never as placeholders) to maintain context at all times.

### Lists
- **Document History:** Tight, clean list items with high-contrast titles and secondary-colored date stamps. Each list item has a minimum height of 64px for easy selection.