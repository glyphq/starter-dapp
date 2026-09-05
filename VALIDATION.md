# Starter cleanup validation

Observed on 2026-09-05. This records the scoped cleanup, not a wallet security audit.

## Requirement-to-evidence map

| Requirement or changed output | Concrete check | Observed result |
| --- | --- | --- |
| Keep changes small and avoid a new architecture | Review the five implementation commits from `4580ebb` through `428bd07` | Origin fixes, scaffolding removal, connector reliability, and adaptation docs are separated. No package extraction or new dependencies. |
| Remove unused scaffolding without breaking the app | Compare tracked UI files and direct dependencies against `a10a08f`, then build and navigate the production export | UI files decreased from 62 to 7. Direct dependencies decreased from 33 to 23. Connect, RandomLottery, and Sign & Verify still render in Chromium at 1440×900 and 390×844. |
| Keep the remaining UI usable and accessible | `bun run qa` against `python3 -m http.server 4174 --bind 127.0.0.1 -d out` | Both viewports: no home overflow, no page errors, and zero serious/critical axe findings on home, connector dialog, contract screen, and signing screen. Screenshots are in ignored `artifacts/screenshots/`. |
| Do not use a demo identity for local wallet requests | Click Connect wallet in the real production UI over local HTTP | Both viewports show public-HTTPS guidance, display zero Glyph launch choices, and make zero relay requests. This is observed browser behavior, not a mocked connector. |
| Resolve and validate request origins | `glyph-origin.test.ts` calls the published SDK validator | Blank/missing overrides use the supplied browser origin. Matching overrides canonicalize. Mismatched, credential-bearing, path/query/fragment-bearing, HTTP and private-address origins reject. These are unit checks, not proof of a deployed native-wallet round trip. |
| Support blank and configured static metadata | Run production builds with `NEXT_PUBLIC_APP_ORIGIN=''` and `NEXT_PUBLIC_APP_ORIGIN=https://dapp.example`, then parse `out/index.html` | Blank configuration builds and omits `og:url`; configured output contains `https://dapp.example/`, as canonicalized by Next.js. No demo fallback is emitted for the blank build. An initial no-trailing-slash assertion was corrected to match the actual canonical output. |
| Simplify preparation without losing error handling | Run the new fresh-preparation rejection test against the original and fixed connector | Original implementation: one failing test due to an unhandled rejection. Fixed implementation: failure is handled, readiness stays false, and the next deliberate retry succeeds. This regression uses a mocked transport. |
| Exercise preparation through the starter's public interfaces | Import `prewarmGlyphRelaySession`, `prepareFreshGlyphRelaySession`, and `isGlyphRelaySessionReady` from the actual starter with Bun, using the real official relay | Two concurrent warmup calls return the same promise. Both finish successfully with readiness true. Fresh preparation also finishes with readiness true. No adapter replacement, fetch interception, or response fixture was used. |
| Exercise the published SDK-to-relay boundary | Call Connect 4.1.0 `prepareRelaySession`, read the actual prepared result URL, then call `subscribeViaRelayV2` with an AbortController and signed-result enforcement | Real registration succeeds (`registered: true`), the authenticated result read returns HTTP 404 while pending, and cancellation returns the typed `aborted` error. No wallet launched and no callback was submitted. |
| Preserve transaction result validation | Parameterized transfer and smart-contract tests in `glyph-action-readiness.test.ts` | Both reject wallet rejection, incorrect status, incorrect request type, and a different account identity. Existing success and readiness cases pass. Transport is mocked. |
| Preserve signed callback, cancellation, timeout/retry and duplicate-launch behavior | Existing `glyph.test.ts`, cancellation, retry, launch, lifecycle and idempotency tests | All pass. Cryptographic callback tests exercise the published SDK with generated signed fixtures; transport lifecycle tests use mocks. Neither is a substitute for native-wallet acceptance. |
| Preserve approval gates | Navigate the real production contract and signing screens without a connected wallet | Both viewports show the contract price field but disable Buy ticket. Sign & Verify shows Wallet required and exposes no Sign message or Verify signature action. No payment or signing request is submitted. |
| Allow connector removal without stale guidance or background sessions | Temporarily remove registered connector entries, build the actual app, open its connector dialog in Chromium, then restore the source and rebuild | Dialog opens, no removed-connector setup hints appear, and zero relay requests occur. The source was restored and the standard QA run passed afterward. No injected provider or mocked response was used for this adaptation check. |
| Keep installation and deployment instructions usable | `npm ci --ignore-scripts --no-audit --no-fund`, full checks/build/QA, then `bun install --frozen-lockfile` | Both installation paths succeed. Tests require Bun, as documented. Both lockfiles are synchronized. Bun still warns about the pre-existing nested override syntax. |
| Improve adaptation documentation | Follow the documented production serving and QA commands; perform the connector-removal exercise above | Commands and connector removal work. README now describes the actual three screens, typed Glyph transaction helpers, readiness rule, permission updates and manual acceptance limits. Complete removal of all Glyph/contract source is guidance, not a separately tested downstream application. |

## What is actually better

The starter has 55 fewer generated UI files and 10 fewer direct dependencies while its real production screens remain navigable and accessible. Local users now receive configuration guidance instead of creating a relay session under the demo origin. A reproduced unhandled-rejection defect is fixed by removing a redundant promise, rather than adding another layer of abstraction.

The final automated suite has 63 passing tests. The count is supporting information; the rows above identify the behavior each check covers. `scripts/qa.mjs` now prints the observed screen-level results, not only an empty failures array.

## Remaining acceptance boundary

The real relay checks above ran on 2026-09-05 using short-lived sessions. They
logged only readiness, HTTP status, and safe error codes. Capabilities and full
session URLs were neither printed nor saved. The relay's documented ten-minute
expiration cleans up the unused sessions. These checks cover live registration,
pending-result access, cancellation, and the starter's preparation integration,
but not callback delivery or wallet approval.

A complete browser → public HTTPS origin → relay → native wallet → signed callback round trip was **not verified**. The local production page was exercised and correctly stops at its HTTPS gate. This session has no configured HTTPS deployment of the modified build or approved test-wallet session. The OS does have a `glyph.desktop` registration pointing to a downloaded AppImage; lack of a binary on PATH is not evidence that Glyph is absent.

No vault was opened, no private key was read, and no wallet approval or paid contract action was performed. Connected signing, real user rejection, native timeout/recovery, and disconnect/reconnect still require manual acceptance with an authorized test wallet. The local UI/build feedback loop is closed; native-wallet integration acceptance remains blocked at these prerequisites. Mock-based tests are explicitly not claimed as its replacement.

## Architecture and UI refactor, 2026-09-05

This section supersedes earlier UI descriptions. Registered unavailable wallets
are now visible as disabled choices, rather than hidden.

| Requirement / changed output | Check and observed result |
| --- | --- |
| Kebab-case source paths | `lib/source-naming.test.ts` scans real app/components/hooks/lib TypeScript filenames. |
| Small feature boundaries | Shell composes wallet/signature/lottery screens. TypeScript, lint and static production build pass with the installed dependencies. No new runtime dependency was added. |
| Three focused flows | Built-export Playwright navigates Connect, RandomLottery, Sign & Verify in desktop/mobile and light/dark contexts. All expected screens visible. |
| Clear connector setup | Actual local page shows disabled Glyph with HTTPS guidance. Opening chooser makes zero relay requests in all four contexts. |
| Keyboard and accessible UI | Escape closes chooser and restores focus. Axe reports zero serious/critical issues on tested screens and chooser. Home has no horizontal overflow. |
| Static assets and theme | Brand images load in exported app. Theme toggle survives reload in all four contexts. No observed page errors. |
| Disconnected safety | Lottery review disabled without Glyph. Signature screen shows Wallet required and no signing controls. |
| Provider rejection/retry/disconnect | `scripts/qa-wallet-boundary.mjs` uses a synthetic extension with the real installed WalletProvider and production UI. Rejection keeps chooser open with safe error, retry establishes account and closes it, disconnect clears saved connector. Passed. This is not a real wallet approval. |
| Short-lived exact-price review | Pure review tests reject closed/zero-price contracts, stale/future timestamps, and changed identity, and preserve reviewed amount. Native wallet launch remains a separate explicit click. |
| Signature input | Pure validation tests cover blank input and malformed signature data. |
| Purchase lifetime | Stable shell hook owns archive tracking and captured submitting identity outside conditional/account-keyed screens. Reviewed in code, not verified with a live paid transaction. |

Latest acceptance command: `bun run test && bun run build && bun run qa`, followed
by `node scripts/qa-wallet-boundary.mjs`. Browser QA uses the actual unmocked static
export for all four viewport/theme contexts. The separate extension fixture is
explicitly synthetic. Live relay checks in the earlier section are historical,
not a claim that a native approval was completed after this refactor.

Remaining boundary: end-to-end Glyph/WalletConnect approval, real signatures,
and paid contract confirmation require an authorized wallet and public HTTPS
origin. No wallet approval, private-key access, or paid transaction was performed.

## Background relay and provider-row iteration

This supersedes earlier statements that chooser opening never prepares a relay:
on public HTTPS it now prewarms. Local HTTP still makes zero relay requests.
The existing four-context production browser suite and extension rejection/retry/
disconnect check pass after converting providers to single native button rows.
74 tests, typecheck, lint, and production build pass.

`node scripts/qa-relay-prewarm.mjs` uses synthetic HTTPS and relay responses around
the real exported app and installed SDK. It observes zero registrations before
chooser intent, one registration after opening, zero automatic native launches,
and exactly one blocked native launch from the first provider click, reusing
the prepared session. It does not contact a real relay or open a real wallet.
Live end-to-end native approval remains unverified. Slow/failed preparation keeps
the explicit retry-click fallback rather than launching outside a user gesture.

## Account modal and minimal chooser

The chooser now hides unconfigured Glyph/WalletConnect entries and shows absent
extensions as disabled rows without setup labels or descriptions. Four real
production viewport/theme checks pass with zero serious/critical axe issues.
The connected header control opens an account modal rather than a dropdown.

The extended `qa-wallet-boundary.mjs` uses explicitly synthetic extension and RPC
responses with the installed provider/query stack. Observed: exact large bigint
QU balance, complete identity, SVG avatar, clipboard equality, mobile dialog
without horizontal overflow, zero serious/critical axe findings, Escape focus
restoration, and disconnect clearing session. It also retains rejection/retry
coverage. Balance loading uses the real RPC client in production, but this fixture
is not evidence of a live balance response or native wallet approval.

## Task-first flow iteration

The starter now opens on Sign & Verify with two example tabs rather than a Connect
landing page. The production suite passes at four viewport/theme combinations.
The synthetic extension fixture additionally confirms that a typed message survives
connection and signed output is copied exactly into verification by its next-action
button. The fixture does not prove a real signature or approval. Result displays
are bound to the original connector/account to reject late cross-account output.
74 tests and production build pass. Exposing the form uncovered tab contrast and
textarea-label regressions, both fixed and checked by the final browser run.

## Compact connection feedback

The built UI passes the four viewport/theme suite. The synthetic extension check
now delays connection and observes exactly one spinner inside the selected
provider's action slot, with its bounding box fully inside the row. After
connection it observes zero session-feedback banners. Account copy, exact balance,
mobile accessibility, focus restoration and disconnect still pass. Routine notices
are hidden; pending actions outside the chooser and actionable errors remain as
flat inline feedback. These tests do not perform a real native-wallet approval.

## UI Skills: tactile controls

Ran `ui-skills start`, inspected interaction skills, and loaded
`jakubkrehel/better-ui`. npm's sharp installation failed; running with
`npm_config_ignore_scripts=true` allowed the CLI to run without modifying app
dependencies. Applied raised surface depth, 0.96 press scaling, a static opt-out,
and transitions limited to transform properties rather than all styles.

`node scripts/qa-button-feel.mjs` exercises the actual production UI with real
pointer and keyboard input. Both motion preferences pass: raised resting shadow,
pressed shadow, 0.96 scale only with no-preference, no displacement for reduced
motion, keyboard focus and Enter activation, disabled controls without elevation.
The first reduced-motion check caught production CSS optimization removing reset
properties; motion is now enabled only inside the no-preference media query.
74 unit tests, typecheck, lint, production build, four viewport/theme QA and wallet
fixture checks pass. No new real native-wallet approval was performed.
