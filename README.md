<div align="center">

# Qubic Starter DApp

A minimal, reusable Next.js reference for connecting Qubic wallets.

[Qubic](https://qubic.org) · [Glyph Connect](https://docs.glyphq.org)

</div>

## What this is

This repository is a small, inspectable starting point for a Qubic dApp. It
keeps the shared wallet wiring in `@qubic.org/react`, registers three connector
paths, and demonstrates three screens: **Connect**, **RandomLottery**, and
**Sign & Verify**. A transfer helper is available in the adapter, but there
is no standalone transfer form in the reference UI.

The included Glyph Wallet adapter is one example connector, not the product
boundary of the starter. Its Relay v2 implementation is isolated in
`lib/connectors/glyph.ts` so it can be kept, replaced, or removed when adapting
the reference to another application.

## Included connector paths

| Connector ID | Package path | Enablement and behavior |
| --- | --- | --- |
| `qubic-extension` | `extensionConnector` from `@qubic.org/react` | Uses an injected Qubic browser provider. It is unavailable when the provider is not installed or injected. |
| `walletconnect` | `createWalletConnectConnector` from `@qubic.org/react` | Uses QR pairing and is disabled until `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is configured. |
| `glyph-wallet` | `glyphConnector` in `lib/connectors/glyph.ts` | Opens the Glyph desktop application through Relay v2. The browser flow needs a public HTTPS origin for deployed use. |

The shared connector surface handles account state, disconnect, transaction
requests, and message signing. The reference UI also supports signature
verification. Verification is local against the connected identity for the
extension and WalletConnect paths; Glyph uses its native verification request.

Glyph-specific actions are intentionally explicit: connect requests ask for
`transfer`, `sc_call`, and `sign_message`. Requests use `@glyph-oss/connect` and
are bound to `qubic:mainnet`. RandomLottery is a real paid contract action, not
a mock transaction. Price and selling state are checked again before launch.
Archive confirmation does not establish a win or refund.

## Quick start

### Requirements

- Node.js 20 or newer, or Bun 1.3 or newer
- A browser for the development server
- A Qubic browser extension, WalletConnect-compatible wallet, or Glyph Wallet
  desktop application for the corresponding connector path

Install and start the app:

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). With npm, use `npm ci`
and `npm run dev`. The test script also requires Bun because its tests use
`bun:test`.

Copy the checked-in example when optional public configuration is needed:

```bash
cp .env.example .env.local
```

Then update the values for your public deployment:

```dotenv
# Optional. Blank uses the current browser origin.
# Overrides must match the public HTTPS origin serving the page.
NEXT_PUBLIC_APP_ORIGIN=

# Optional. Enables WalletConnect in the connector chooser.
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

`NEXT_PUBLIC_APP_ORIGIN` is used as the dApp origin in wallet metadata and
Glyph requests. For a deployed Glyph flow it should be a credential-free,
canonical HTTPS origin without a path, query, or fragment. When absent or blank,
the current browser origin is used. An explicit override must match the page
origin. There is no demo-origin fallback. Local HTTP browsing and extension
flows still work, but Glyph requires a public HTTPS deployment or tunnel.
The connector chooser explains missing configuration before preparing a relay.

Both variables are client-visible configuration. They are not places for
private keys, API tokens, relay capabilities, callback URLs, or wallet session
secrets. Keep `.env.local` untracked; environment files are ignored by this
repository.

## Connector behavior and boundaries

The wallet remains the approval boundary. This app asks a selected connector
to perform an action, but it cannot approve a transfer or sign a message on a
user's behalf. Review the destination, amount, message, and active network in
the wallet before approving.

For Glyph Wallet, the adapter prepares a short-lived Relay v2 session before
launching a desktop deep link. The returned callback is accepted only after
the SDK and adapter verify the signed response against the expected request
type, nonce, request hash, dApp identity, callback session, account identity,
and `qubic:mainnet` binding. Interrupted requests use a bounded recovery
window and a retry creates a fresh session and request. The app does not
relaunch an old deep link.

Relay capabilities and signed material stay inside the connector flow. Do not
log, copy, persist, or send them to analytics or application servers. The
available safe diagnostic intentionally excludes callback URLs, signed
payloads, proof fields, identities, origin, user-entered message and amount,
and raw errors.

The app is a static client export. Browser storage may restore a connector
account for convenience, but it is not a secret store and it does not replace
wallet or callback verification. Add a server only for an application-specific
need, with a separate threat model and server-side secret handling.

## Customize the starter

Use the existing seams rather than copying wallet-specific behavior into the
page:

| File | Customization point |
| --- | --- |
| `app/page.tsx` | Replace the reference screen with the application's route entry. |
| `components/starter-app.tsx` | Change the wallet workspace, forms, and action orchestration. |
| `components/app-providers.tsx` | Configure `QubicProvider`, `WalletProvider`, the live client, and the browser storage key. |
| `lib/connectors/index.ts` | Register, remove, or configure connector instances. Keep optional configuration client-safe. |
| `lib/connectors/glyph.ts` | Keep or replace the isolated Glyph Relay v2 adapter and its native transfer/sign/verify requests. |
| `app/globals.css` | Replace the reference visual system without changing connector behavior. |
| `app/layout.tsx` | Update fonts and application metadata for the consuming dApp. |
| `next.config.ts` | Keep or change the static export strategy deliberately. |

When adding a connector, implement the `WalletConnector` contract and make
availability explicit. Do not display an unavailable wallet as detected, and
do not assume that a connector supports an action just because another
connector does.

### Start with one action

For message signing, follow `signMessage()` in `components/starter-app.tsx`:

1. Read the connected account and connector with `useWallet()`.
2. For Glyph, check `isGlyphRelaySessionReady()`. If it is not ready, prepare
   the relay, show the preparation state, and return from the handler.
3. On the next deliberate click, call `wallet.signMessage(message)` without
   awaiting network work first. This preserves the browser gesture for Glyph.
4. Display `signatureHex`, handle rejection, and clear the busy state in `finally`.

Do not put relay preparation on hover, focus, or component mount. Do not retry
by automatically opening the wallet after an asynchronous preparation.
`requestGlyphTransfer()` and `requestGlyphScCall()` use the same readiness rule.
Glyph's generic `sendTransaction()` and `signTransaction()` are intentionally
unsupported. Use the typed helpers rather than constructing protocol messages
in the UI.

### Remove what your app does not need

- **A wallet option:** remove its entry from `connectors` in
  `lib/connectors/index.ts`. Remove its construction, imports, and configuration
  if no longer used. The chooser only explains registered connectors.
- **Glyph entirely:** also remove Glyph-specific readiness/status handling and
  imports from `StarterApp.tsx`. Replace or remove RandomLottery, which requires
  Glyph. Then delete the adapter and its tests, and remove `@glyph-oss/connect`
  after replacing the shared origin validator used by WalletConnect.
- **The contract example:** remove the RandomLottery screen, state, polling
  effect, and imports from `StarterApp.tsx`, then remove `lib/contracts/`.
  Drop the unused `sc_call` permission and update the permission fixtures.
- **Unused permissions:** keep the requested permission list and its tests in
  sync. The adapter intentionally checks the exact granted set.
- **Extra UI:** add components only when a screen needs them. `components/ui/`
  contains the seven primitives used by this reference, not a full UI kit.

After adapting a flow, update its unit tests and `scripts/qa.mjs`, then run the
checks below. Keep signed callback verification and mainnet binding intact.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the development server. |
| `bun run typecheck` | Check TypeScript. |
| `bun run lint` | Run ESLint. |
| `bun run test` | Run type checking, linting, and connector protocol tests. |
| `bun run build` | Create the static production export in `out/`. |
| `bun run qa` | Run the responsive Playwright and axe checks. |

Browser QA runs against an already-served production export:

```bash
bun run build
python3 -m http.server 4174 --bind 127.0.0.1 -d out
# In another terminal:
bun run qa
```

If Chromium is missing, install it with `bunx playwright install chromium`.
`QA_BASE_URL` overrides the default `http://127.0.0.1:4174`. QA checks desktop
and mobile navigation, accessibility, and local-origin guidance without
opening a wallet or submitting a paid request. Unit tests cover signed
callback validation, rejection, retries, preparation failures, and duplicate
launches. A real wallet approval round trip still needs separate manual testing.

## Static deployment

Build and serve the generated files from a public HTTPS origin:

```bash
bun run build
python3 -m http.server 4174 -d out
```

For a deployed Glyph flow, leave `NEXT_PUBLIC_APP_ORIGIN` blank to use the
serving origin, or configure that exact origin at build time. WalletConnect
also uses this public HTTPS origin policy for its client metadata.

## Project map

```text
app/
  layout.tsx           Metadata, fonts, and providers
  page.tsx             Application entry
components/
  Providers.tsx        Qubic and wallet providers
  StarterApp.tsx       Reference wallet workspace
lib/connectors/
  index.ts             Registered connector set
  glyph.ts             Isolated Glyph Wallet adapter
  glyph-origin.ts      Shared public-origin policy
  glyph-relay-adapter.ts  Relay lifecycle seam
lib/contracts/         RandomLottery encoding, preflight, and archive status
```

This is independent software built for Qubic. It is not an official Qubic
organization or a replacement for wallet security review.
