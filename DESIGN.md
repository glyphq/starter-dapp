# Starter dApp design system

## Direction

The interface extends the Glyph website system into a focused product UI. It uses monochrome OLED surfaces, rounded but restrained geometry, strong type hierarchy, and compact technical metadata. Structure comes from spacing, contrast, and alignment rather than heavy borders.

## Typography

- Geist for interface and editorial text.
- Geist Mono for identities, tick values, status labels, and technical metadata.
- Fixed, readable product-interface sizing rather than landing-page display scale.

## Color

Dark mode is the primary presentation and uses black, near-black surfaces, white text, and neutral gray states. Light mode uses warm white and neutral charcoal. Semantic green, amber, and red are reserved for success, configuration, and error states.

## Geometry

- Small controls: 8px radius.
- Panels: 16px radius.
- Primary controls: minimum 46px height.
- Layout width: 1280px maximum with responsive gutters.

## Interaction

- No page transitions.
- No button movement on hover.
- Short color and opacity changes only.
- Loading controls replace their leading icon with a spinner.
- Every state remains understandable with reduced motion enabled.

## Iconography

Solar icons only. Buttons use one meaningful leading icon. Arrows and generic external-link glyphs are not used as button decoration.

## Responsive behavior

Desktop uses a connector rail and workspace. Mobile becomes a single logical column, preserves source order, and keeps all controls at touch-friendly sizes. QR content scales within the viewport.
