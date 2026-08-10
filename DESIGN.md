# Starter dApp design system

## Direction

The interface extends Glyph wallet principles into a focused product UI. It uses calm monochrome surfaces, restrained geometry, quiet technical metadata, and divider-led hierarchy. The workspace avoids card grids so the wallet state, selected action, and connector sheet feel like one shared control surface.

## Typography

- Geist for interface and editorial text.
- Geist Mono for identities, tick values, status labels, and technical metadata.
- Minimal copy with readable product-interface sizing rather than landing-page display scale.

## Color

Dark mode is the primary presentation and uses black, near-black surfaces, white text, and neutral gray states. Light mode uses warm white and neutral charcoal. Semantic green, amber, and red are reserved for success, configuration, and error states.

## Geometry

- Small controls: 10px radius.
- Sheets and rails: 16 to 24px radius.
- Primary controls: minimum 48px height.
- Layout width: 580px centered wallet workspace with responsive gutters.

## Interaction

- No page transitions.
- No button movement or shrink-on-click.
- Short color and opacity changes only.
- Loading controls replace their leading icon with a spinner.
- Keyboard focus is visible on every pressable control and field.
- Every state remains understandable with reduced motion enabled.

## Iconography

Solar icons only, globally rendered in a linear/outline style. Buttons use one meaningful leading icon. Arrows and generic external-link glyphs are not used as button decoration.

## Responsive behavior

Desktop and mobile use one centered wallet workspace. Connector selection appears in a focused modal, preserving the wallet state as the primary interface.
