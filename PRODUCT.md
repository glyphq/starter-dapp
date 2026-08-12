# Qubic Starter DApp

## Product definition

Qubic Starter DApp is a compact reference implementation for connecting Qubic
wallets from a Next.js application. It demonstrates the shared
`@qubic.org/react` provider and connector contract, while keeping the
Glyph-specific Relay v2 adapter behind a separate seam.

It is meant to be copied as a starting point, inspected while integrating a
wallet, or reduced to the connector paths an application actually supports.
It is not a finished wallet product or a general-purpose transaction SDK.

## Audience

Qubic application developers who need a working baseline for:

- connector selection and explicit availability states;
- account connect, restore, and disconnect flows;
- wallet-approved transfers and message signing; and
- local or wallet-assisted signature verification.

## Included reference paths

| Path | Current behavior |
| --- | --- |
| Qubic browser extension | Uses the injected provider exposed by `@qubic.org/react`. |
| WalletConnect | Uses QR pairing and requires `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`. |
| Glyph Wallet | Uses a desktop deep link and Relay v2 session. Glyph requests are explicitly bound to `qubic:mainnet`. |

The connector registry is intentionally small. A consuming application should
remove connectors it does not want to support instead of presenting them as
available by default.

## Core workflows

1. Choose a connector and connect an account.
2. Inspect the active identity and disconnect it.
3. Request a transfer from the selected wallet.
4. Ask the wallet to sign a message.
5. Verify a signature against the connected identity.

The shared connector contract is the default integration seam. Glyph transfer,
signing, and verification use its native request builders because its wallet
callbacks do not map every operation to the shared transaction method. The
reference UI therefore keeps those Glyph operations explicit rather than
pretending that every connector has identical capabilities.

## Customization points

- `app/page.tsx`: replace the reference route entry.
- `components/StarterApp.tsx`: replace the demo workspace and action forms.
- `components/Providers.tsx`: configure providers, the live client, and local
  connector persistence.
- `lib/connectors/index.ts`: register or remove connector instances and keep
  optional configuration client-safe.
- `lib/connectors/glyph.ts`: keep, replace, or remove the Glyph adapter.
- `app/globals.css`: replace presentation without changing wallet semantics.
- `app/layout.tsx`: set the consuming app's fonts and metadata.

## Security boundaries

- Wallets own approval. The dApp can prepare a request, but it cannot approve
  a transfer or sign a message for the user.
- `NEXT_PUBLIC_*` values are embedded in the browser. The starter has no
  server-side secret configuration. Never place private keys, API tokens,
  callback URLs, relay capabilities, or wallet session secrets in them.
- The Glyph adapter accepts callbacks only after signed-response checks bind
  them to the expected request, account, dApp origin, relay session, and
  `qubic:mainnet` network. Recovery is bounded, and retry creates a fresh
  session and request.
- Relay capabilities and signed payloads stay inside the connector flow. Safe
  diagnostics are allow-listed and exclude callback URLs, proof material,
  identities, user input, and raw errors.
- Browser persistence is convenience state, not key storage or proof of wallet
  authorization. Disconnect and callback verification remain explicit.

## Non-goals

- No private-key management or signing outside a connected wallet.
- No smart-contract UI, application backend, or server callback API.
- No claim that an unavailable or unconfigured connector is supported at
  runtime.
- No universal transaction abstraction when a connector exposes a
  wallet-specific request path.

## Product character

Minimal, inspectable, technically honest, and easy to adapt. UI copy should
name the connector and its requirement, keep approval in the wallet, and make
failure and retry behavior visible without exposing sensitive protocol data.

Qubic Starter DApp is independent software built for the Qubic network. It is
not an official Qubic organization.
