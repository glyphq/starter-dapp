<div align="center">

# Glyph Starter

A minimal Next.js reference for Qubic wallet connections and reviewed contract actions.

[Qubic](https://qubic.org) · [Glyph Connect](https://docs.glyphq.org)

</div>

## What this is

Glyph Starter is a small, inspectable Qubic dApp baseline. It composes the
shared `@qubic.org/react` wallet provider with three connector paths and three
focused examples:

- **Sign & Verify** signs a message or checks a signature for the active identity.
- **QEarn** reads protocol statistics and prepares the QEarn `Lock` procedure.
- **QUtil** reads protocol fees and prepares the QUtil `Vote` procedure.

The two contract examples are deliberately curated, not a generic contract
dashboard. Their selectors expose only reviewed actions built with
`@qubic.org/contracts`, so users never enter a raw contract index, input type,
or binary payload.

## Wallet behavior

| Connector | Behavior |
| --- | --- |
| Qubic browser extension | Uses the injected provider from `@qubic.org/react`. It is disabled when not installed. |
| WalletConnect | Uses QR pairing, requires `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, and sends `qubic_sign` input as `{ message }` for Qubic Wallet compatibility. |
| Glyph Wallet | Uses a Relay v2 desktop deep link and requires a public HTTPS deployment. |

Wallets remain the approval boundary. Read-only QEarn and QUtil queries work
without a wallet. A procedure displays only **Connect wallet** while no account
is connected, then opens the selected wallet only after an explicit submit.

- QEarn **Lock QU** attaches the entered whole-QU amount to contract 9, input
  type 1.
- QUtil **Vote in a poll** encodes the connected identity, poll ID, option, and
  vote amount with the generated QUtil wrapper. It attaches zero QU to contract
  4, input type 5.

Review every wallet request. A procedure may change on-chain state. This starter
does not initiate requests automatically.

## Quick start

Requirements: Node.js 20+ or Bun 1.3+, plus a supported wallet only when you
want to exercise a connector.

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). npm users can run `npm ci`
and `npm run dev`. Tests use `bun:test`, so they still require Bun.

Optional public deployment settings belong in `.env.local`:

```dotenv
# Blank uses the current browser origin. An override must match the public HTTPS origin.
NEXT_PUBLIC_APP_ORIGIN=

# Enables WalletConnect in the chooser.
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

These values are browser-visible. Never put private keys, API tokens, relay
capabilities, callback URLs, or wallet session secrets in `NEXT_PUBLIC_*`.

## Architecture

Source paths use kebab-case. Component symbols stay PascalCase.

- `components/starter-app.tsx` owns shell composition, hero CTAs, and modal state.
- `components/wallet/wallet-session-provider.tsx` owns connection state, shared
  request locking, safe feedback, and background Glyph relay preparation.
- `components/wallet/request-status.tsx` turns shared wallet progress, success,
  and failure feedback into global toasts instead of dialog cards.
- `components/signatures/signatures-screen.tsx` owns signing and verification inputs.
- `components/contract-call/contract-examples-screen.tsx` owns the QEarn and
  QUtil selectors, query results, and procedure form state.
- `lib/contracts/starter-contracts.ts` is the reviewed typed boundary for
  QEarn and QUtil queries, procedure encoding, numeric validation, and payload
  conversion.
- `lib/connectors/glyph.ts` isolates the Glyph Relay v2 adapter and native
  smart-contract request path.

The browser extension and WalletConnect use the shared `sendTransaction` call.
Glyph intentionally uses `requestGlyphScCall()` because its native callback
protocol is handled through its signed Relay boundary.

`lib/connectors/wallet-connect.ts` is a small compatibility adapter around the
WalletConnect client. It keeps the upstream connector contract while sending a
map-shaped `qubic_sign` parameter that Qubic Wallet expects.

## Glyph relay behavior

When the wallet chooser opens on a valid HTTPS origin, the app may prepare a
Relay session in the background. Preparation registers a session only. It never
launches or approves a wallet action. A prepared session lets the next deliberate
Glyph action use one click. If preparation is incomplete, the user sees a retry
prompt instead. Local HTTP pages do not register a relay session.

The adapter verifies signed callbacks against the expected request type, nonce,
request hash, app identity, callback session, account identity, and
`qubic:mainnet`. Relay capabilities and signed payloads stay inside the adapter
and are not copied to UI diagnostics.

## Adaptation guide

Use the existing seams rather than putting connector-specific logic in a page:

| Need | Change |
| --- | --- |
| Add or remove a connector | `lib/connectors/index.ts` and its availability handling |
| Change wallet state behavior | `components/wallet/wallet-session-provider.tsx` |
| Add a reviewed contract action | `lib/contracts/starter-contracts.ts`, then its UI and tests |
| Replace the signing flow | `components/signatures/signatures-screen.tsx` |
| Change the shell | `components/starter-app.tsx` and `app/globals.css` |

For every new procedure, keep a typed builder, validate user fields before a
wallet request, document whether QU is attached, and add a fixture test for the
exact request shape. Do not add a raw ABI form to this starter.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the development server. |
| `bun run typecheck` | Check TypeScript. |
| `bun run lint` | Run ESLint. |
| `bun run test` | Run type checking, linting, and isolated tests. |
| `bun run build` | Build the static production output. |
| `bun run qa` | Run responsive Playwright and axe checks against an already-served app. |

For browser QA:

```bash
bun run build
bunx serve out -l 4174
# In another terminal:
bun run qa
node scripts/qa-wallet-boundary.mjs
```

`qa.mjs` checks desktop and mobile layouts, selector widths, theme persistence,
accessibility, connector chooser behavior, the disconnected procedure gate, and
absence of runtime errors. `qa-wallet-boundary.mjs` runs the real production UI
against a synthetic extension to check rejection, retry, signing, disconnect,
exact QEarn/QUtil request shapes, and toast-based transient feedback.

Those checks do **not** prove an actual native wallet round trip. A deployed
HTTPS build and an authorized test wallet are still required to verify a real
Glyph or WalletConnect approval, or an on-chain transaction.

## Project map

```text
app/                         Route, metadata, global styling
components/
  starter-app.tsx            Hero, account header, and modal composition
  wallet/                    Connection and account UI
  signatures/                Sign and verify flow
  contract-call/             QEarn and QUtil contract examples
lib/
  contracts/                 Typed, reviewed starter contract actions
  connectors/                Connector registry and Glyph Relay adapter
scripts/                     Browser, wallet-boundary, and tactile UI QA
```

This is independent software built for Qubic. It is not an official Qubic
organization or a replacement for wallet security review.
