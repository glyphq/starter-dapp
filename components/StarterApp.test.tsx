import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GlyphRequestLifecycle, StarterActionTabs, starterActionRegistry } from "./StarterApp";
import type { GlyphRequestFeedback } from "@/lib/connectors/glyph";

describe("Qubic reference examples", () => {
  test("registers the route-like starter sections in order", () => {
    expect(starterActionRegistry.map((item) => item.id)).toEqual([
      "overview",
      "wallet",
      "transfer",
      "sign-verify",
    ]);
  });

  test("exposes isolated transfer, sign, and verify actions", () => {
    const markup = renderToStaticMarkup(
      <StarterActionTabs activeAction="transfer" onChange={() => undefined} />,
    );

    expect(markup).toContain("Transfer");
    expect(markup).toContain("Sign");
    expect(markup).toContain("Verify");
    expect(markup).toContain('aria-selected="true"');
  });

});

describe("Glyph request lifecycle UX", () => {
  test("shows bounded recovery progress and a safe support ID without a continue-wait action", () => {
    const feedback: GlyphRequestFeedback = {
      requestId: "local-1",
      requestType: "transfer",
      state: "recovering",
      supportId: "support-1234",
      relayMilestone: "result_recovered_via_poll",
      pollAttempt: 2,
      pollMaxAttempts: 12,
    };
    const markup = renderToStaticMarkup(
      <GlyphRequestLifecycle
        feedback={feedback}
        preparing={false}
        onRetry={() => undefined}
        onCopyDiagnostic={() => undefined}
        diagnosticCopied={false}
      />,
    );

    expect(markup).toContain("Recovering result");
    expect(markup).toContain("2/12");
    expect(markup).toContain("Support ID");
    expect(markup).toContain("support-1234");
    expect(markup).not.toContain("Continue waiting");
  });

  test("offers only a retry and safe diagnostic after interruption", () => {
    const feedback: GlyphRequestFeedback = {
      requestId: "local-2",
      requestType: "connect",
      state: "interrupted",
      failureCode: "relay_timeout",
      relayErrorCode: "poll_exhausted",
      supportId: "support-5678",
    };
    const markup = renderToStaticMarkup(
      <GlyphRequestLifecycle
        feedback={feedback}
        preparing={false}
        onRetry={() => undefined}
        onCopyDiagnostic={() => undefined}
        diagnosticCopied={false}
      />,
    );

    expect(markup).toContain("Retry");
    expect(markup).toContain("Diagnostic");
    expect(markup).not.toContain("Continue waiting");
    expect(markup).not.toContain("poll_exhausted");
  });
});
