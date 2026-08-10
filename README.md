<div align="center">

# Glyph Qubic Starter

A multi-wallet reference application for Qubic.

[Glyph](https://glyphq.org) · [Documentation](https://docs.glyphq.org) · [Qubic](https://qubic.org)

</div>

## Overview

Glyph Qubic Starter demonstrates a maintainable wallet connection layer built with
`@qubic.org/react`. It includes the official Qubic connectors and adds Glyph
Wallet through `@glyph-oss/connect`.

The interface provides:

- Glyph Wallet desktop deep-link connection
- Qubic browser extension connection
- WalletConnect pairing
- Restored wallet sessions
- Focused connector selection modal
- Wallet-approved transfer requests
- User-approved message signing
- Local signature verification
- Responsive light and dark themes

## Connector support

| Connector | Package | Requirement |
| --- | --- | --- |
| Glyph Wallet | `@glyph-oss/connect` | Glyph Wallet desktop application |
| Qubic browser extension | `@qubic.org/react` | Injected Qubic browser provider |
| WalletConnect | `@qubic.org/react` | WalletConnect project ID |

The Glyph integration uses `@glyph-oss/connect@4.0.1` native Glyph Connect v2
requests for wallet-approved transfers, message signing, and signature
verification. Every launched request explicitly binds to `qubic:mainnet`.
Signature values are normalized to the hexadecimal format used by the shared
Qubic connector API.

## Requirements

- Bun 1.3 or newer
- Node.js 20 or newer
- A WalletConnect project ID to enable WalletConnect
- An HTTPS public origin for Glyph dApp metadata

## Setup

```bash
bun install
cp .env.example .env.local
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

```dotenv
NEXT_PUBLIC_APP_ORIGIN=https://starter.glyphq.org
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

`NEXT_PUBLIC_APP_ORIGIN` identifies the application to Glyph Wallet and must be
a credential-free public HTTPS origin with no path, query, or fragment.

Glyph Wallet returns desktop requests through the official Glyph relay v2 flow.
The app prepares and registers a relay session before launch, passes only the
prepared callback capability to the wallet, and keeps the read capability in the
dApp subscription for result validation through `@glyph-oss/connect`.

## Glyph Connect v4 protocol and callback security

Glyph launches only `glyph://v2/request?d=<base64url-envelope>` URLs. The v2
envelope uses `glyph-connect-request/2`, includes a deterministic
`sha256:<base64url>` request hash, and explicitly binds the request to
`qubic:mainnet`. Legacy request links are not supported.

Relay results must be signed `glyph-connect-callback-envelope/2` responses. The
connector requires `@glyph-oss/connect` verification before accepting a result:

- Qubic SchnorrQ verification over the K12 digest of the canonical signed payload
- the request nonce and type
- the prepared envelope's request hash and mainnet binding
- the raw prepared relay callback URL. `@glyph-oss/connect` canonicalizes only official Relay v2 write capabilities to Wallet's signed fingerprint binding, while preserving strict session and capability matching

Unsigned, tampered, cross-network, or mismatched callback envelopes are rejected.

WalletConnect remains visible but disabled until a project ID is configured.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the development server |
| `bun run typecheck` | Check TypeScript |
| `bun run lint` | Run ESLint |
| `bun run test` | Run type checking, linting, and protocol unit tests |
| `bun run build` | Create the static production export |
| `bun run qa` | Run responsive Playwright and axe checks |

## Project structure

```text
app/
  globals.css          Glyph wallet-inspired interface system
  layout.tsx           Metadata, fonts, and providers
  page.tsx             Application entry
components/
  Providers.tsx        Qubic and wallet providers
  StarterApp.tsx       Responsive wallet workspace
lib/connectors/
  glyph.ts              Glyph Wallet adapter
  index.ts              Registered connector set
scripts/
  qa.mjs                Browser and accessibility checks
```

## Static deployment

The production build is exported to `out/`. The host must serve the generated
HTML files from the same public HTTPS origin configured in `NEXT_PUBLIC_APP_ORIGIN`.

```bash
bun run build
python3 -m http.server 4174 -d out
```

## Design system

The app uses the same visual foundation as the Glyph public website:

- Geist and Geist Mono from local packages
- Monochrome OLED surfaces
- Warm neutral light mode
- Linear Solar icons
- Divider-led hierarchy with shared elevated controls
- Restrained rounded geometry and no card grids
- Semantic success, warning, and error states
- Reduced-motion support
- WCAG 2.2 AA interaction targets and focus states

See [DESIGN.md](DESIGN.md) and [PRODUCT.md](PRODUCT.md) for implementation
principles and product constraints.

## Independence

Glyph is an independent community project building software for the Qubic
network. It is not an official Qubic organization.
