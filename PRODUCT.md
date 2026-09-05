# Glyph Starter

## Product definition

Glyph Starter is a compact Qubic wallet-integration reference for Next.js. It
shows a small, task-first surface for common wallet behavior and two selected
smart-contract examples. It is meant to be copied and adapted, not used as a
general-purpose contract dashboard or transaction SDK.

## Audience

Qubic application developers who need a working baseline for:

- explicit connector availability, connect, restore, and disconnect behavior;
- account details with identity, identicon, and live balance;
- message signing and verification; and
- reviewed QEarn and QUtil queries and procedures.

## Included reference paths

| Path | Current behavior |
| --- | --- |
| Qubic browser extension | Uses the injected provider through `@qubic.org/react`. |
| WalletConnect | Uses QR pairing when a public project ID is configured and sends Qubic Wallet's expected map-shaped signing input. |
| Glyph Wallet | Uses an explicit Relay v2 desktop request bound to `qubic:mainnet`. |
| Sign & Verify | Gates message actions behind a connected wallet and keeps approval in the wallet. |
| QEarn | Reads protocol stats or prepares the generated `Lock` procedure. |
| QUtil | Reads protocol fees or prepares the generated `Vote` procedure. |

## Contract examples

The contract selector is intentionally constrained to QEarn and QUtil. It
contains a small action selector per contract rather than all deployed
contracts or a raw ABI form.

- Queries use the live RPC client and need no wallet approval.
- Procedures use generated `@qubic.org/contracts` builders and validate whole
  numbers before a wallet request.
- QEarn `Lock QU` attaches the entered QU amount.
- QUtil `Vote in a poll` uses the connected identity and carries its vote amount
  in the generated payload, while attaching zero QU.
- The exact transaction still appears in the user's wallet for approval.

## Product constraints

- No private-key management or signing outside a connected wallet.
- No generic contract index, input-type, or binary-payload form.
- No automatic wallet launch after asynchronous preparation.
- No claim that an unavailable connector works at runtime.
- No claim that a mocked browser fixture establishes a real on-chain approval.

## Character

Minimal, tactile, and inspectable. The hero gives direct access to three useful
starter tasks. Dialogs are compact, their selectors hold a stable full width,
and no redundant footer, status card, or cancel action competes with the task.
Transient request feedback uses global toasts, while durable signed and query
outputs remain in the task that produced them.

Glyph Starter is independent software built for the Qubic network. It is not an
official Qubic organization.
