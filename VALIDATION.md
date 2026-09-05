# Starter validation

Observed on 2026-09-05. This records the current focused starter behavior. It is
not a wallet-security audit.

## Requirement-to-evidence map

| Requirement or changed public output         | Concrete check                                                                                                        | Observed result                                                                                                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expose only direct starter actions           | `components/starter-app.test.tsx` and `scripts/qa.mjs` against the static export                                      | The hero exposes exactly **Sign & Verify**, **Lock QUs**, and **Send QUs**. It has no generic Contract call CTA.                                                                                    |
| Remove generic contract selectors            | `scripts/qa.mjs` at desktop and mobile viewports                                                                      | The disconnected Lock QUs and Send QUs dialogs contain no select controls or raw ABI inputs. Each has exactly one Connect wallet action.                                                            |
| Build QEarn Lock safely                      | `lib/contracts/starter-procedures.test.ts`                                                                            | QEarn Lock resolves to contract 9, input type 1, with the entered positive whole-QU amount attached. Zero is rejected before a request is built.                                                    |
| Build direct transfers safely                | `lib/contracts/starter-procedures.test.ts` and `scripts/qa-wallet-boundary.mjs`                                       | A normalized Qubic identity and positive whole-QU amount form one direct wallet transaction. Malformed identities and zero amounts are rejected before the wallet boundary.                         |
| Keep raw ABI fields out of the UI            | `scripts/qa.mjs` and `scripts/qa-wallet-boundary.mjs`                                                                 | Users enter only reviewed amounts and Qubic identities. Contract indices, input types, and encoded payloads are not editable.                                                                       |
| Keep direct dialogs compact and responsive   | `scripts/qa.mjs` at 1440×900 and 390×844, plus populated mobile transfer coverage in `scripts/qa-wallet-boundary.mjs` | Direct dialogs measure at most 480px desktop, have no horizontal overflow on a populated 390px form, and report zero serious or critical axe findings.                                              |
| Preserve accessible, responsive UI           | `scripts/qa.mjs`                                                                                                      | Four viewport and theme runs report no horizontal overflow, no runtime errors, and zero serious or critical axe findings on home, connector, Lock QUs, Send QUs, and signing dialogs.               |
| Keep transient feedback outside task content | `scripts/qa-wallet-boundary.mjs` through the built UI                                                                 | Connection, signature, procedure, and identity-copy feedback render as toasts. The task dialogs contain no inline session feedback card or approval banner.                                         |
| Use identity avatars in wallet feedback      | `scripts/qa-wallet-boundary.mjs` through the built UI                                                                 | Connected, approval, and copied-identity toasts include an identicon. The redundant “Your keys remain in your wallet” copy is absent.                                                               |
| Improve account details controls             | `scripts/qa-wallet-boundary.mjs` through the built UI                                                                 | The balance refresh control is icon-only, tick copy is absent, and compact Copy identity and Disconnect controls carry icons. The fixture identity, avatar, and exact balance render correctly.     |
| Keep buttons flat but animated               | `scripts/qa-button-feel.mjs` with motion allowed and reduced                                                          | Buttons have no resting or pressed depth shadow, retain a 0.98 press animation when motion is allowed, preserve keyboard focus and activation, and disable motion under reduced-motion preferences. |
| Qubic extension transaction sender bridge    | `lib/connectors/qubic-extension.test.ts` and `scripts/qa-wallet-boundary.mjs`                                         | The extension adapter reads its current account for each request and includes that identity as `from` on reviewed smart-contract and direct-transfer transactions.                                  |
| Preserve WalletConnect signing compatibility | `lib/connectors/wallet-connect.test.ts`                                                                               | The custom WalletConnect connector calls `qubic_sign` with connected `{ from, message }` fields, not a bare string.                                                                                 |
| Preserve relay behavior                      | `scripts/qa-relay-prewarm.mjs`                                                                                        | Synthetic HTTPS/relay check reports background registration, no automatic launch, one provider-click launch, and one registration.                                                                  |
| Preserve full-viewport Plasma hero           | `scripts/qa-explorer-shell.mjs`                                                                                       | The hero is full viewport, Plasma is disabled for reduced motion, the footer is absent, the header remains correctly positioned, and no runtime errors occur.                                       |
| Static production output remains valid       | `bun run test && bun run build`                                                                                       | TypeScript and lint pass. The isolated suite passes 67 tests with 317 expectations. Next.js produces static `/` and `/_not-found` routes.                                                           |

## Current limitations

The responsive browser and wallet-boundary tests use the actual built UI. The
wallet-submission test intentionally substitutes a synthetic extension and
captures its request objects. The WalletConnect signing-shape test also uses a
fixture client. They prove the local UI-to-provider boundary, not a native wallet
approval or an on-chain result.

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
evidence, not a substitute for the asserted browser results.
