# Interface and state design

## Three focused tasks

The full-viewport hero exposes three direct CTAs: **Sign & Verify**, **Lock
QUs**, and **Send to many**. Each CTA opens a compact dialog instead of rendering
a permanent card or navigation surface. The dialog close control and Escape key
are the only dismissal affordances. There is no redundant Cancel action.

Each contract CTA opens its own feature-local form. This avoids a generic
contract selector, prevents content-dependent layout shifts, and keeps the
available action obvious.

## Ownership

- `components/starter-app.tsx`: shell, hero CTAs, modal state, account header.
- `components/wallet/wallet-session-provider.tsx`: one active connector,
  shared connection state, single-flight request lock, concise feedback, and
  Glyph relay preparation.
- `components/wallet/request-status.tsx`: maps shared wallet progress and
  transient outcomes to global identity-aware toasts.
- `components/signatures/signatures-screen.tsx`: signing, verification, and
  durable result state.
- `components/qearn/lock-qus-screen.tsx`: QEarn Lock inputs and submission.
- `components/qutil/send-to-many-screen.tsx`: QUtil SendToMany recipient queue
  and one-at-a-time approval progression.
- `lib/contracts/starter-procedures.ts`: reviewed typed builders, numeric and
  identity validation, and payload conversion.
- `lib/connectors/glyph.ts`: signed Glyph Relay v2 request boundary.

Feature screens own their temporary fields and results. The shell does not own
contract inputs or wallet requests.

## Feedback

Transient updates and errors never consume modal layout. Connection progress,
wallet outcomes, copy feedback, and validation errors use the shared toast
region. Wallet-related outcome toasts use the active or just-disconnected
identity's avatar. Durable artifacts remain in their task: a signed message stays
available for copy or verification.

## Procedure gate

Each direct procedure presents exactly one primary action, **Connect wallet**,
while disconnected. It does not render procedure inputs or a submit control until
the connection succeeds.

Once connected, **Lock QUs** accepts a positive whole attached-QU amount for
QEarn. **Send to many** collects validated Qubic recipient-and-amount pairs.
QUtil's installed SendToMany V1 ABI encodes one pair per request, so the UI
queues the generated calls and asks for an explicit approval for each one. All
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
dialogs are bounded to 480px on desktop, responsive on mobile, and use the same
available width for content and controls. Dialogs and forms must retain zero
serious or critical axe findings.

Source paths use kebab-case. Component symbols use PascalCase. Prefer
feature-local code to a generic state machine or redundant data store.
