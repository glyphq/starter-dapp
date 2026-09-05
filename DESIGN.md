# Interface and state design

## Three focused tasks

The full-viewport hero exposes three direct CTAs: **Sign & Verify**, **QEarn**,
and **QUtil**. Each CTA opens a compact dialog instead of rendering a permanent
card or navigation surface. The dialog close control and Escape key are the
only dismissal affordances. There is no redundant Cancel action.

QEarn and QUtil share one contract example screen. The initial hero CTA selects
the relevant contract, then the screen's full-width Contract and Action
selectors allow the user to switch between the two reviewed contracts.

## Ownership

- `components/starter-app.tsx`: shell, hero CTAs, modal state, account header.
- `components/wallet/wallet-session-provider.tsx`: shared connection state,
  single-flight request lock, safe feedback, and Glyph relay preparation.
- `components/wallet/request-status.tsx`: maps shared wallet progress and
  transient outcomes to global toasts.
- `components/signatures/signatures-screen.tsx`: signing, verification, and
  result state.
- `components/contract-call/contract-examples-screen.tsx`: contract/action
  selection, query result state, procedure inputs, and submission state.
- `lib/contracts/starter-contracts.ts`: reviewed contract metadata, generated
  typed builders, numeric validation, and payload conversion.
- `lib/connectors/glyph.ts`: signed Glyph Relay v2 request boundary.

Feature screens own their temporary fields and results. The shell does not own
contract inputs or wallet requests.

## Feedback

Transient updates and errors never consume modal layout. Connection progress,
wallet outcomes, copy feedback, validation errors, and query updates use the
shared toast region. Durable artifacts remain in their task: a signed message
stays available for copy or verification, and a read-only contract response
stays available for inspection.

## Procedure gate

Read-only QEarn and QUtil queries remain usable without an account. Choosing a
procedure while disconnected presents exactly one primary action: **Connect
wallet**. It does not render procedure inputs or a submit control until the
connection succeeds.

Once connected, QEarn `Lock QU` accepts a whole attached-QU amount. QUtil
`Vote in a poll` accepts a poll ID, option, and contract-defined vote amount.
The connected identity is supplied by the wallet, never typed by the user. All
ABI encoding comes from `@qubic.org/contracts`; no UI field represents a raw
payload or contract index.

## Wallet and relay constraints

Preparation never resumes a wallet action automatically. Opening the chooser on
a valid HTTPS page can register a Glyph Relay session in the background, but it
never launches a wallet. A deliberate action launches the wallet when ready or
asks for one repeat click after preparation.

The browser extension and WalletConnect use their `sendTransaction` capability.
Glyph uses its native signed `sc_call` request. Requests stay bound to mainnet
and account identity. Mainnet approval remains in the wallet.

The local WalletConnect adapter sends signing input as `{ message }` because
Qubic Wallet expects a map for `qubic_sign`. This is a narrow protocol bridge,
not a second signing path or a fallback that could duplicate a request.

## Visual and accessibility constraints

The full-bleed Plasma hero is decorative and disabled under reduced motion.
Buttons retain tactile raised and pressed states with keyboard focus. Task
dialogs are bounded to 480px on desktop, responsive on mobile, and their
content, selectors, and action controls use the same available width. Dialogs,
forms, and selector changes must retain zero serious or critical axe findings.

Source paths use kebab-case. Component symbols use PascalCase. Prefer
feature-local code to a generic state machine or redundant data store.
