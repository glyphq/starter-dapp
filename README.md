<div align="center">

# Glyph Starter

A minimal Next.js reference for Qubic wallet connections and reviewed contract actions.

[Qubic](https://qubic.org) · [Glyph Connect](https://docs.glyphq.org)

</div>

## What this is

Glyph Starter is a small, inspectable Qubic dApp baseline. It composes the
shared `@qubic.org/react` wallet provider with supported connector paths and
three focused actions:

- **Sign & Verify** signs a message or checks a signature for the active identity.
- **Lock QUs** prepares QEarn's generated `Lock` procedure.
- **Send to many** prepares QUtil's generated `SendToMany V1` procedure.

The contract actions are deliberately curated. There is no generic contract
form, raw contract index, input type, or binary payload field. Each action
builds one reviewed request with `@qubic.org/contracts` and leaves approval to
the wallet.

## Wallet behavior

| Connector               | Behavior                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Qubic browser extension | Uses the injected provider from `@qubic.org/react`. It is disabled when not installed.                                                          |
| WalletConnect           | Uses QR pairing, requires `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, and sends `qubic_sign` input as `{ message }` for Qubic Wallet compatibility. |
| Glyph Wallet            | Uses a Relay v2 desktop deep link and requires a public HTTPS deployment.                                                                       |

A disconnected action presents only **Connect wallet**. Inputs and its submit
control appear only once an account connects.

- **Lock QUs** attaches the entered positive whole-QU amount to QEarn contract
  9, input type 1.
- **Send to many** uses QUtil contract 4, input type 1. It turns each entered
  recipient-and-amount pair into a generated request and attaches zero QU. The
  installed V1 ABI encodes one pair per request, so each recipient gets a
  separate explicit wallet approval.

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
- `components/wallet/wallet-session-provider.tsx` owns one active connector,
  connection state, shared request locking, safe feedback, and background Glyph
  relay preparation.
- `components/wallet/request-status.tsx` turns shared wallet progress and
  outcomes into global, identity-aware toasts rather than dialog cards.
- `components/signatures/signatures-screen.tsx` owns signing and verification
  inputs and durable signature results.
- `components/qearn/lock-qus-screen.tsx` owns the direct QEarn Lock form.
- `components/qutil/send-to-many-screen.tsx` owns the direct QUtil SendToMany
  recipient queue and explicit approval progression.
- `lib/contracts/starter-procedures.ts` is the reviewed typed boundary for
  QEarn Lock, QUtil SendToMany V1, numeric validation, identity validation, and
  payload conversion.
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

| Need                           | Change                                                                   |
| ------------------------------ | ------------------------------------------------------------------------ |
| Add or remove a connector      | `lib/connectors/index.ts` and its availability handling                  |
| Change wallet state behavior   | `components/wallet/wallet-session-provider.tsx`                          |
| Add a reviewed contract action | `lib/contracts/starter-procedures.ts`, a feature-local screen, and tests |
| Replace the signing flow       | `components/signatures/signatures-screen.tsx`                            |
| Change the shell               | `components/starter-app.tsx` and `app/globals.css`                       |

For every new procedure, keep a typed builder, validate user fields before a
wallet request, document whether QU is attached, and add a fixture test for the
exact request shape. Do not add a raw ABI form to this starter.

## Commands

| Command             | Purpose                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `bun run dev`       | Start the development server.                                           |
| `bun run typecheck` | Check TypeScript.                                                       |
| `bun run lint`      | Run ESLint.                                                             |
| `bun run test`      | Run type checking, linting, and isolated tests.                         |
| `bun run build`     | Build the static production output.                                     |
| `bun run qa`        | Run responsive Playwright and axe checks against an already-served app. |

For browser QA:

```bash
bun run build
bunx serve out -l 4174
# In another terminal:
bun run qa
node scripts/qa-wallet-boundary.mjs
```

`qa.mjs` checks desktop and mobile layouts, theme persistence, accessibility,
connector chooser behavior, direct disconnected action gates, and absence of
runtime errors. `qa-wallet-boundary.mjs` runs the built UI against a synthetic
extension to check rejection, retry, signing, direct QEarn/QUtil request shapes,
identity-aware toasts, and account behavior.

Those checks do **not** prove an actual native wallet round trip. A deployed
HTTPS build and an authorized test wallet are still required to verify a real
Glyph or WalletConnect approval, or an on-chain transaction.

## Project map

```text
app/                         Route, metadata, global styling
components/
  starter-app.tsx            Hero, account header, and modal composition
  wallet/                    Connection, account UI, and global toasts
  signatures/                Sign and verify flow
  qearn/                     Direct Lock QUs flow
  qutil/                     Direct Send to many flow
lib/
  contracts/                 Typed, reviewed starter procedures
  connectors/                Connector registry and Glyph Relay adapter
scripts/                     Browser, wallet-boundary, and tactile UI QA
```

This is independent software built for Qubic. It is not an official Qubic
organization product.
