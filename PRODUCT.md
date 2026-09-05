# Glyph Starter

## Product definition

Glyph Starter is a compact Qubic wallet-integration reference for Next.js. It
shows a small, task-first surface for common wallet behavior and two selected
smart-contract actions. It is meant to be copied and adapted, not used as a
general-purpose contract dashboard or transaction SDK.

## Audience

Qubic application developers who need a working baseline for:

- explicit connector availability, connect, restore, and disconnect behavior;
- account details with identity, identicon, and live balance;
- message signing and verification; and
- reviewed QEarn Lock and QUtil SendToMany procedures.

## Included reference paths

| Path                    | Current behavior                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Qubic browser extension | Uses the injected provider through `@qubic.org/react`.                                                             |
| WalletConnect           | Uses QR pairing when a public project ID is configured and sends Qubic Wallet's expected map-shaped signing input. |
| Glyph Wallet            | Uses an explicit Relay v2 desktop request bound to `qubic:mainnet`.                                                |
| Sign & Verify           | Gates message actions behind a connected wallet and keeps approval in the wallet.                                  |
| Lock QUs                | Prepares QEarn's generated `Lock` procedure with an attached whole-QU amount.                                      |
| Send to many            | Collects multiple recipients and prepares one generated QUtil `SendToMany V1` request for each explicit approval.  |

## Contract actions

The contract surface is intentionally constrained to one direct action per
selected contract. It does not expose every deployed contract or a raw ABI form.

- Actions use generated `@qubic.org/contracts` builders and validate input
  before a wallet request.
- QEarn **Lock QUs** attaches the entered positive whole-QU amount.
- QUtil **Send to many** collects recipient-and-amount pairs, encodes one V1
  payload per pair, and attaches zero QU to each request.
- The exact transaction still appears in the user's wallet for approval.

## Product constraints

- No private-key management or signing outside a connected wallet.
- No generic contract index, input-type, or binary-payload form.
- No fabricated multi-recipient payload when the installed ABI encodes one
  recipient and amount per approval. Each queued request needs its own approval.
- No automatic wallet launch after asynchronous preparation.
- No claim that an unavailable connector works at runtime.
- No claim that a mocked browser fixture establishes a real on-chain approval.

## Character

Minimal, tactile, and inspectable. The hero gives direct access to three useful
starter tasks. Dialogs are compact and task-specific, and no redundant footer,
status card, selector, or cancel action competes with the task. Transient request
feedback uses global identity-aware toasts, while durable signed output remains
in the task that produced it.

Glyph Starter is independent software built for the Qubic network. It is not an
official Qubic organization.
