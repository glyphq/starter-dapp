# Glyph Qubic Starter dApp

## Product definition

The Glyph Qubic Starter dApp is a reference application for connecting Qubic wallets through one clear interface. It demonstrates the current connector surface from `@qubic.org/react` and adds Glyph Wallet through `@glyph-oss/connect`.

## Audience

Qubic application developers who need a working, inspectable starting point for wallet connection, account state, transfers, and message signing.

## Primary jobs

- Compare every supported connector in one interface.
- Connect a wallet and inspect the active identity.
- Test a wallet-approved transfer.
- Test a user-approved message signature.
- Verify a message signature locally.
- Copy a maintainable connector structure into another application.

## Product character

Precise, calm, technical, and transparent. The application should feel like maintained public software rather than a promotional crypto interface.

## Constraints

- Never imply that unavailable connectors were detected.
- Never fabricate transaction support or wallet capabilities.
- Glyph Wallet connection uses a desktop deep link and a browser callback route.
- Glyph transaction helpers remain available directly through `@glyph-oss/connect`; the shared adapter only implements methods that can truthfully satisfy the common result contract.
- WalletConnect requires an application project ID.

## Relationship statement

Glyph is an independent community project building software for the Qubic network.
