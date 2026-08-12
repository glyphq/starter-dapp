import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GlyphRequestLifecycle } from "./StarterApp";
import type { GlyphRequestFeedback } from "@/lib/connectors/glyph";

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
    expect(markup).toContain("attempt 2 of 12");
    expect(markup).toContain("Support ID");
    expect(markup).toContain("support-1234");
    expect(markup).not.toContain("Continue waiting");
    expect(markup).not.toContain("Retry with a new request");
  });

  test("offers only a fresh-request retry and safe diagnostic copy after interruption", () => {
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

    expect(markup).toContain("Retry with a new request");
    expect(markup).toContain("Copy safe diagnostic");
    expect(markup).not.toContain("Continue waiting");
    expect(markup).not.toContain("poll_exhausted");
  });
});
