# Interface and state design

## Three focused tasks

The full-viewport hero exposes three direct CTAs: **Sign & Verify**, **Lock
QUs**, and **Send QUs**. Each CTA opens a compact dialog instead of rendering
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
- `components/transfers/send-qu-screen.tsx`: direct QU transfer inputs and
  submission.
- `lib/contracts/starter-procedures.ts`: reviewed typed builders, numeric and
  identity validation, and payload conversion.
- `lib/connectors/qubic-extension.ts`: injects the extension's active sender into
  each transaction request.
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

Each direct task presents exactly one primary action, **Connect wallet**,
while disconnected. It does not render procedure inputs or a submit control until
the connection succeeds.

Once connected, **Lock QUs** accepts a positive whole attached-QU amount for
QEarn. **Send QUs** collects one validated Qubic recipient identity and a
positive whole-QU amount. The transfer is always shown by the connected wallet
for explicit approval. QEarn ABI encoding comes from `@qubic.org/contracts`;
no UI field represents a raw payload or contract index.

## Wallet and relay constraints

Preparation never resumes a wallet action automatically. Opening the chooser on
a valid HTTPS page can register a Glyph Relay session in the background, but it
never launches a wallet. A deliberate action launches the wallet when ready or
asks for one repeat click after preparation.

The browser extension uses a local adapter that reads its current account and
adds that active `from` identity to every transaction request. WalletConnect
uses its `sendTransaction` capability. Glyph uses its native signed `sc_call`
for QEarn and `transfer` for Send QUs.
Requests stay bound to mainnet and account identity. Mainnet approval remains in
the wallet.

The local WalletConnect adapter accepts only a checksum-valid `qubic:mainnet`
account whose session grants every method this starter requests. It adds the
connected sender to both transaction inputs and the `{ from, message }` map that
Qubic Wallet expects for `qubic_sign`. This is a narrow protocol bridge, not a
second signing path or a fallback that could duplicate a request.

## Visual and accessibility constraints

The full-bleed Plasma hero is decorative and disabled under reduced motion.
Buttons stay flat while retaining press animation and keyboard focus. Task
dialogs are bounded to 480px on desktop, responsive on mobile, and use the same
available width for content and controls. Dialogs and forms must retain zero
serious or critical axe findings.

Source paths use kebab-case. Component symbols use PascalCase. Prefer
feature-local code to a generic state machine or redundant data store.
