# Design System Specification: High-End Collaborative Workspace

## 1. Overview & Creative North Star

### Creative North Star: "The Digital Atheneum"
This design system moves away from the chaotic, "boxy" feel of traditional SaaS tools and toward an editorial, curated environment. It treats the digital workspace as a high-end physical studio—airy, quiet, and profoundly organized. 

The system rejects the "standard UI" by embracing **intentional asymmetry** and **tonal layering**. We achieve a premium feel by prioritizing negative space over structural lines. By removing heavy borders and rigid grids, we create a "liquid" layout where focus is directed by typography and subtle shifts in surface depth rather than visual noise.

---

## 2. Colors: Tonal Architecture

Our palette is inspired by the transition of light through glass. We use sophisticated purples and muted blues not just for brand presence, but as functional indicators of depth.

### The "No-Line" Rule
**Explicit Instruction:** Use of 1px solid borders for sectioning or layout containment is strictly prohibited. 
- Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` panel should sit directly on a `background` or `surface` canvas. 
- Use the **Spacing Scale (8, 10, or 12)** to create breathing room between these tonal regions.

### Surface Hierarchy & Nesting
Treat the UI as a series of nested physical layers. 
- **Base Level:** `background` (#f8f9fd).
- **Secondary Surfaces:** `surface-container-low` (#f1f4f9) for global sidebars or chatbot panels.
- **Actionable Containers:** `surface-container-lowest` (#ffffff) for primary content cards or input areas. This creates a natural "lift" that feels professional and intentional.

### The "Glass & Gradient" Rule
To elevate components above the "out-of-the-box" look:
- **Floating Elements:** Use `primary-container` (#6c63ff) with a 20% opacity and a 16px backdrop-blur for floating modals or context menus.
- **Signature Textures:** Apply a subtle linear gradient from `primary` (#5044e3) to `primary-container` (#6c63ff) on primary CTAs to provide visual "soul" and depth.

---

## 3. Typography: Editorial Authority

We use a dual-font strategy to balance character with professional clarity.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision and modern weight. Use `headline-lg` for page titles to establish an authoritative editorial voice.
*   **Body & Labels (Inter):** A workhorse for readability. Use `body-md` for collaborative chat and `body-lg` for long-form analysis.

**Hierarchy as Identity:** 
We use large contrast scales (e.g., pairing a `display-sm` title with a `label-md` uppercase subtitle) to create an asymmetric, "designed" look that guides the eye naturally through complex workflows.

---

## 4. Elevation & Depth: The Layering Principle

Hierarchy is achieved through **Tonal Layering** rather than structural shadows.

*   **Stacking Tiers:** Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a soft, natural lift without the need for a border.
*   **Ambient Shadows:** For floating panels (like the Chatbot), use extra-diffused shadows. 
    *   *Shadow Formula:* `0px 12px 32px rgba(45, 51, 57, 0.06)`. The shadow color is a tinted version of `on-surface` to mimic natural light.
*   **The "Ghost Border" Fallback:** If a container requires definition against an identical color (e.g., white on white), use the `outline-variant` (#adb2ba) at **15% opacity**. Never use a 100% opaque border.
*   **Backdrop Blur:** The right-hand chatbot panel should utilize a subtle backdrop-blur (8px) when overlaid on mobile, maintaining the "frosted glass" aesthetic.

---

## 5. Signature Components

### Collapsible Sidebar (The Navigator)
- **Background:** `surface-container-low`.
- **Active State:** Use a "Pill" shape (`rounded-full`) in `primary-fixed-variant` with `on-primary-container` text.
- **Animation:** Use a 300ms ease-in-out transition for collapsing. When collapsed, icons should be centered with `spacing-4` vertical gaps.

### Multi-Step Progress Navigation (The Flow)
- **5 Flows:** Team Prep → Analysis → Design → Development → Evaluation.
- **Visual Style:** Avoid traditional "stepper" circles. Use a horizontal "Breadcrumb-Plus" style.
- **Active Step:** `headline-sm` weight, color: `primary`.
- **Inactive Steps:** `title-sm`, color: `outline`.
- **Transition:** A subtle underline in `surface-tint` (#5044e3) that slides between steps.

### Chatbot Panel (The Assistant)
- **Container:** `surface-container-lowest` with a "Ghost Border."
- **Message Bubbles:**
    - *User:* `secondary-container` with `on-secondary-container` text. `rounded-xl` but with the bottom-right corner at `rounded-sm`.
    - *AI:* `surface-container-high` with `on-surface` text. `rounded-xl` but with the bottom-left corner at `rounded-sm`.
- **Input:** A `rounded-full` container using `surface-container-low`.

### Primary Action Buttons
- **Style:** `rounded-md` (0.375rem). 
- **Color:** Gradient of `primary` to `primary-dim`.
- **Elevation:** No shadow on rest; a subtle `primary` glow on hover (4px blur, 10% opacity).

---

## 6. Do's and Don'ts

### Do
- **DO** use white space as a structural element. If you think you need a divider, try adding `spacing-8` of vertical space instead.
- **DO** use `manrope` for any text larger than 18px to maintain the "Editorial" feel.
- **DO** nest containers using the Surface Scale: `background` → `surface-container-low` → `surface-container-lowest`.

### Don't
- **DON'T** use black (#000000) for text. Always use `on-surface` (#2d3339) for a softer, more premium contrast.
- **DON'T** use the `DEFAULT` (0.25rem) radius for large layout containers; use `xl` (0.75rem) to maintain the "Soft Minimalist" aesthetic.
- **DON'T** use high-saturation shadows. If a shadow looks "grey," it is too heavy. It should look like a soft "glow" of darkness.
- **DON'T** use 1px dividers. If content needs separation, use a background color shift to `surface-container-highest`.