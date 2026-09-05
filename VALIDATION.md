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

A complete browser → public HTTPS origin → relay → native wallet → signed callback round trip was **not verified**. The local production page was exercised and correctly stops at its HTTPS gate. This session has no configured HTTPS deployment of the modified build or approved test-wallet session. The OS does have a `glyph.desktop` registration pointing to a downloaded AppImage; lack of a binary on PATH is not evidence that Glyph is absent.

No vault was opened, no private key was read, and no wallet approval or paid contract action was performed. Connected signing, real user rejection, native timeout/recovery, and disconnect/reconnect still require manual acceptance with an authorized test wallet. The local UI/build feedback loop is closed; native-wallet integration acceptance remains blocked at these prerequisites. Mock-based tests are explicitly not claimed as its replacement.
