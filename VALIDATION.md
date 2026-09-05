# Starter validation

Observed on 2026-09-05. This records the current focused starter behavior. It
is not a wallet-security audit.

## Requirement-to-evidence map

| Requirement or changed public output | Concrete check | Observed result |
| --- | --- | --- |
| Focus the starter on selected contracts | `starter-contracts.test.ts` and `starter-app.test.tsx` | The only contract IDs are QEarn and QUtil. The hero exposes Sign & Verify, QEarn, and QUtil, with no generic Contract call CTA. |
| Use generated contract procedures | `starter-contracts.test.ts` calls the installed `@qubic.org/contracts` builders | QEarn Lock resolves to contract 9 input type 1 with the entered amount. QUtil Vote resolves to contract 4 input type 5 with a generated 56-byte payload. |
| Reject unsafe procedure input before wallet launch | `starter-contracts.test.ts` | Zero or malformed QEarn amount and malformed QUtil option throw before a request is built. |
| Keep raw ABI fields out of the UI | `scripts/qa.mjs` against the static production export | QEarn and QUtil each show two selected actions. Queries are visible without a wallet. Selecting a procedure exposes exactly one Connect wallet action and no input fields. |
| Use the connected identity for QUtil voting | `scripts/qa-wallet-boundary.mjs` through the production UI and real `WalletProvider` | The synthetic extension receives a QUtil contract-4, input-type-5 request with the package-generated payload and no attached QU. |
| Attach QEarn lock amount correctly | `scripts/qa-wallet-boundary.mjs` through the production UI and real `WalletProvider` | The synthetic extension receives contract-9, input-type-1 with the entered `1000000` QU amount. |
| Keep compact dialogs stable | `scripts/qa.mjs` at 1440×900 and 390×844 in light and dark themes | QEarn's contract and action selectors match the full screen width. Modals measure at most 480px desktop and 364.6px mobile in the observed run. |
| Remove redundant cancel actions | `scripts/qa.mjs` modal navigation with Escape | All dialogs close with Escape and restore focus to their opener. The task footer no longer adds a Cancel button. |
| Preserve accessible, responsive UI | `scripts/qa.mjs` with axe | Four viewport/theme runs report no horizontal overflow, no runtime errors, and zero serious or critical axe findings on home, chooser, QEarn, QUtil, and signing dialogs. |
| Preserve wallet behavior | `scripts/qa-wallet-boundary.mjs` | First connection rejection retains the chooser, retry connects, signing form appears only after connection, account details show a valid fixture identity/avatar/balance, disconnect clears the session, and provider spinner stays inside its selected row. |
| Put transient feedback in toasts | `scripts/qa-wallet-boundary.mjs` through the built UI | Connection rejection and success, signature creation, contract approval, and identity copying render as toasts. The task dialog contains no inline approval text or session feedback card. |
| Send Qubic WalletConnect signing input in its expected shape | `wallet-connect.test.ts` | The custom WalletConnect connector calls `qubic_sign` with `{ message }`, not a bare string. |
| Preserve relay behavior | `scripts/qa-relay-prewarm.mjs` | Synthetic HTTPS/relay check reports background registration, no automatic launch, one provider click launch, and one registration. |
| Preserve motion and hero behavior | `scripts/qa-explorer-shell.mjs` and `scripts/qa-button-feel.mjs` | Hero is full viewport, Plasma is disabled for reduced motion, footer is absent, and tactile buttons retain pointer and keyboard feedback without raising disabled controls. |
| Static production output remains valid | `bun run test && bun run build` | TypeScript and lint pass. Isolated suite passes 68 tests. Next.js produces static `/` and `/_not-found` routes. |

## Current limitations

The responsive browser and wallet-boundary tests use the actual built UI. The
procedure submission test intentionally substitutes a synthetic extension and
captures its request objects. The WalletConnect signing-shape test also uses a
fixture client. They prove the local UI-to-provider boundary, not a native
wallet approval or an on-chain result.

A complete browser → public HTTPS origin → Glyph Relay → native wallet → signed
callback round trip is still unverified in this environment. It requires a
deployed HTTPS build and an authorized test wallet. No wallet was launched, no
private key was read, and no real contract procedure was approved while gathering
this evidence.

## Re-run commands

```bash
bun run test
bun run build
bunx serve out -l 4174
# In another terminal:
node scripts/qa.mjs
node scripts/qa-wallet-boundary.mjs
node scripts/qa-relay-prewarm.mjs
node scripts/qa-explorer-shell.mjs
node scripts/qa-button-feel.mjs
```

Screenshots are written to ignored `artifacts/screenshots/`. They are inspection
evidence, not a substitute for the asserted browser results above.
