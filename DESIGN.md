# Qubic Starter DApp

## Direction

Qubic Starter is a compact, reusable wallet workspace for Qubic apps. The visible shell has four focused sections: Overview, Wallet, Transfer, and Sign & Verify. Selecting a section swaps one task surface in place without dashboard filler or marketing copy.

Overview shows the active identity, wallet, live QU balance, and three useful next actions. Wallet manages available wallet choices and the active account. Transfer, sign, and verify keep one task per surface and retain the existing secure request handlers.

## Visual language

- Calm monochrome near-black and warm-white themes.
- Space Grotesk for interface copy and Geist Mono for identities, signatures, transaction IDs, and literal code values.
- Dense workspace hierarchy with separators, rows, and simple action bars instead of card grids.
- Generated shadcn Sidebar, Dialog, DropdownMenu, Tabs, Separator, Input, Textarea, Skeleton, Tooltip, Button, and Sonner primitives drive interaction ergonomics.
- Hugeicons provide navigation, wallet, action, status, and feedback icons. The real Glyph mark is loaded from `public/brand/glyph-mark.png` as a discreet wallet affordance.
- Theme state persists through `qubic-starter-theme` in local storage and `data-theme` on the document root.

## Data and states

The overview balance uses the existing `@qubic.org/react` `useBalance` query backed by the configured Qubic provider. It renders a Skeleton while loading, a compact unavailable state with retry on query failure, and the returned QU balance with its valid tick. No balance, token, history, chart, or network value is fabricated.

Account identities, transaction IDs, and signatures remain abbreviated or copyable where appropriate. User-facing failures use short safe messages. Raw connector errors, callback URLs, protocol secrets, and support internals are not primary UI copy.

## Scope

The app owns only UI composition, accessible state presentation, and the generated component layer. Existing connector implementations, request handlers, provider configuration, environment policy, and secure prewarm behavior remain unchanged.
