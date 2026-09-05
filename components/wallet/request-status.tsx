"use client";

import { glyphRequestMilestoneLabel } from "@/lib/connectors/glyph";
import { useWalletSession } from "./wallet-session-provider";
import { Button } from "@/components/ui/button";

export function LoadingIcon() {
  return <span className="spinner" aria-hidden="true" />;
}

export function RequestStatus() {
  const { pendingAction, error, notice, feedback, dismissFeedback } =
    useWalletSession();
  if (!pendingAction && !error && !notice) return null;
  const interrupted = feedback?.state === "interrupted";
  const title = error
    ? interrupted
      ? "Request not completed"
      : "Something needs your attention"
    : (pendingAction ?? "Ready");
  const message =
    error ??
    (pendingAction && feedback && feedback.state !== "completed"
      ? glyphRequestMilestoneLabel(feedback.state)
      : (notice ??
        "Keep this page open. Any approval happens in your wallet."));
  return (
    <div
      className={`session-feedback ${error ? "is-error" : ""}`}
      role={error ? "alert" : "status"}
      aria-live="polite"
    >
      {pendingAction && <LoadingIcon />}
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {!pendingAction && (
        <Button
          variant="ghost"
          size="sm"
          onClick={dismissFeedback}
          aria-label="Dismiss wallet status"
        >
          Dismiss
        </Button>
      )}
    </div>
  );
}
