# Monoskill Website Design

## Theme

A developer in a dim workspace is watching skill descriptions accumulate like rising water in an agent's context. The scene calls for a dark, low-glare chamber where the flood drains through a mechanical throat into one warm Monoskill package.

## Brand Voice

- Mechanical
- Convergent
- Assured

## Color Strategy

Committed. Deep violet-tinted neutrals carry the surface; a hot vermilion thread marks motion and action, while warm parchment marks the compiled mono-skill as a tangible object.

## Palette

- `--ink`: `oklch(0.15 0.018 288)`
- `--ink-raised`: `oklch(0.205 0.024 288)`
- `--paper`: `oklch(0.94 0.018 76)`
- `--muted`: `oklch(0.71 0.025 286)`
- `--thread`: `oklch(0.69 0.205 31)`
- `--thread-hot`: `oklch(0.78 0.17 52)`
- `--line`: `oklch(0.34 0.035 287)`
- `--success`: `oklch(0.77 0.14 151)`

## Typography

Use the system's condensed display face when available (`Avenir Next Condensed`, `Arial Narrow`) for the convergence statement and platform UI sans for everything else. Use the platform monospace only for commands, paths, and manifest fragments, never as a general developer aesthetic.

## Layout

The page is a sequence of three physical states: discovery metadata raises a visible context flood, a siphon clears it through a compression throat, then one provider-level Monoskill remains. The wide layout uses an asymmetric 12-column composition; mobile turns the same drain into a vertical flow. A measured Corey Haines example makes the compression concrete.

## Components

- A code-native convergence field made from semantic skill fragments, SVG paths, and one package silhouette.
- A visible, qualified comparison of individual discovery metadata against the compiled entry point.
- One dominant labeled source input with inferred-name editing immediately downstream.
- Two copy surfaces for the live CLI command and AI-ready prompt, visually subordinate to the input but available without scrolling on a common laptop viewport.
- A short `npx` how-to below the generator; provenance is linked as technical documentation rather than presented as a marketing section.
- Inline validation and status text announced with `aria-live`, never toast-only.

## Motion

The opening state shows all 47 real Corey Haines skills inside an already-flooded discovery context, with an empty Monoskill visible as their destination. Each skill box follows its own measured path through the compression throat. As the boxes enter, the water falls, the Monoskill reveals a 47-item internal grid, and the filled package settles to the bottom. Input completion tightens the field and briefly seals the package. Copy actions use a restrained color and label transition. Use transform and opacity only, with exponential easing. Reduced motion shows the fully drained end state and retains the full collection count.

The four-frame art-direction reference is `docs/storyboards/context-flood-47-skills.png`.

## Responsive Behavior

At narrow widths, the convergence field becomes a compact vertical diagram, actions become full-width, code wraps or scrolls without clipping, and touch targets remain at least 44px. At wide widths, the generator overlaps the convergence story spatially without obscuring text or focus order.
