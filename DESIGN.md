# Interface and state design

## Three focused flows

Connect, RandomLottery, and Sign & Verify share a compact shell, wallet chooser,
identity menu, and persistent theme. The UI uses local Geist fonts, monochrome
surfaces, readable state labels, keyboard focus, and responsive action groups.
Unavailable registered connectors remain visible with setup requirements.
Opening the chooser never starts a relay session.

## Ownership

- `components/starter-app.tsx`: navigation and composition, not request logic.
- `components/wallet/wallet-session-provider.tsx`: shared connection state,
  synchronous request lock, safe feedback, and relay preparation.
- `components/signatures/`: message fields and signature validation/results.
- `components/random-lottery/`: live price, short-lived review, explicit approval.
- `hooks/use-lottery-purchase.ts`: archive tracking independent of screen lifetime.
- `lib/`: connector protocols, pure validation, contract encoding and queries.

Account-keyed feature screens reset form results on account changes. Purchase
tracking retains the submitting identity across navigation and account changes,
but does not survive a full page reload. Do not move it into a conditional screen.

## Interaction constraints

Preparation never automatically resumes a wallet action. A deliberate subsequent
click preserves the browser gesture for a native launch. Lottery review captures
price and account, expires after 30 seconds, and precedes a separate wallet click.
An installed provider may report a connection error in state without rejecting
its promise. Only an observed account transition establishes connection success.

Keys, callback capabilities, signed protocol payloads, and raw errors never belong
in UI diagnostics. Mainnet approval remains in the wallet. Source paths use
kebab-case, component symbols use PascalCase. Prefer feature-local code over a
new framework, generic state machine, or redundant data store.
