# Interface and state design

## Two task-first examples

Sign & Verify and RandomLottery share a compact shell, wallet chooser,
account details modal, and persistent theme. The UI uses local Geist fonts, monochrome
surfaces, readable state labels, keyboard focus, and responsive action groups.
Unconfigured connectors are hidden. Missing extensions remain disabled, without
setup labels or technical descriptions.
Opening the chooser on valid HTTPS starts background relay preparation, never
a wallet launch. Connected Glyph sessions are replenished between actions.
Each provider is one keyboard-accessible row, not a row with a separate button.

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

## Flat workspace iteration

The main workspace uses open sections and underline navigation rather than
rounded container cards. Account, price, result, and connector details use ruled
rows. Dialogs and editable inputs remain contained. This is a presentation-only
change, with no changes to wallet request behavior.

The connected header control opens `account-dialog.tsx`: full public identity,
wallet name, mainnet, live QU balance and its tick, refresh, copy, and disconnect.
Balance queries run only while open and retain bigint precision. Failed loads
show unavailable, never a fabricated zero. The identicon uses the same
boring-avatars marble variant and palette as Glyph wallet, seeded by identity.

## Minimal shell

The shell omits the marketing hero, duplicate example links and repeated account
summary. Account management stays in the header modal. The connection screen is
one prompt and action. Header/footer accents use static CSS dot patterns with
gradient masks, no effects dependency or animation. Decorations do not intercept
pointer input and are hidden in forced-color mode. Contract approval and price
review warnings remain intact.

## Task-first progression

Sign & Verify is the entry screen. Users can draft a message before connecting.
Connection does not discard the draft or automatically request a signature.
After signing, Verify this signature transfers the exact output into the verify
form. Results remain bound to the submitting account, including late responses.
Drafts reset when switching examples or reloading, not when connecting.
The separate Connect landing page is removed. RandomLottery remains an explicit
paid mainnet example with unchanged review and approval checks.
