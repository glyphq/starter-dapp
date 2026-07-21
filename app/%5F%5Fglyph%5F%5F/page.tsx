"use client";

import {
  base64UrlToString,
  GLYPH_RESULT_CHANNEL_PREFIX,
  parseCallbackResponse,
} from "@glyph-oss/connect";
import { CheckCircle, CloseCircle, RefreshCircle } from "@solar-icons/react";
import { useEffect, useState } from "react";

type CallbackState = "processing" | "completed" | "missing" | "invalid";

export default function GlyphCallbackPage() {
  const [state, setState] = useState<CallbackState>("processing");

  useEffect(() => {
    let cancelled = false;
    let closeTimer: number | undefined;

    queueMicrotask(() => {
      if (cancelled) return;
      const encoded = new URLSearchParams(window.location.search).get("result");
      if (!encoded) {
        setState("missing");
        return;
      }

      try {
        const result = parseCallbackResponse(JSON.parse(base64UrlToString(encoded)) as unknown);
        const channel = new BroadcastChannel(`${GLYPH_RESULT_CHANNEL_PREFIX}${result.nonce}`);
        channel.postMessage(result);
        channel.close();

        if (window.opener && !window.opener.closed) window.opener.focus();
        setState("completed");
        closeTimer = window.setTimeout(() => window.close(), 1200);
      } catch {
        setState("invalid");
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(closeTimer);
    };
  }, []);

  const content = {
    processing: {
      Icon: RefreshCircle,
      title: "Returning to the application",
      copy: "Delivering the wallet response to the original tab.",
    },
    completed: {
      Icon: CheckCircle,
      title: "Request completed",
      copy: "Returning to the application. This tab will close automatically.",
    },
    missing: {
      Icon: CloseCircle,
      title: "No wallet response found",
      copy: "You can close this tab and return to the application.",
    },
    invalid: {
      Icon: CloseCircle,
      title: "The wallet response could not be read",
      copy: "Close this tab and retry the request from the application.",
    },
  }[state];

  return (
    <main className="callback-page">
      <a className="callback-brand" href="https://glyphq.org" aria-label="Glyph home">
        glyph<span>.</span>
      </a>
      <section className={`callback-status callback-status-${state}`} aria-live="polite">
        <span className="callback-icon" aria-hidden="true">
          <content.Icon />
        </span>
        <p className="callback-eyebrow">Glyph Wallet</p>
        <h1>{content.title}</h1>
        <p>{content.copy}</p>
        {state !== "processing" && (
          <button className="quiet-button" onClick={() => window.close()}>
            <CloseCircle aria-hidden="true" />
            Close this tab
          </button>
        )}
      </section>
    </main>
  );
}
