"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { glyphRequestMilestoneLabel } from "@/lib/connectors/glyph";
import { useWalletSession } from "./wallet-session-provider";

export function LoadingIcon() {
  return <span className="spinner" aria-hidden="true" />;
}

export function RequestStatus() {
  const { pendingAction, error, notice, feedback, dismissFeedback } =
    useWalletSession();
  const pendingToast = useRef<string | number | null>(null);

  useEffect(() => {
    if (!pendingAction) {
      if (pendingToast.current !== null) {
        toast.dismiss(pendingToast.current);
        pendingToast.current = null;
      }
      return;
    }

    if (pendingToast.current !== null) toast.dismiss(pendingToast.current);
    pendingToast.current = toast.loading(pendingAction, {
      description: "Keep this page open. Any approval happens in your wallet.",
    });
  }, [pendingAction]);

  useEffect(() => {
    if (!pendingAction || !feedback || feedback.state === "completed") return;
    const id = pendingToast.current ?? "wallet-request";
    pendingToast.current = id;
    toast.loading(pendingAction, {
      id,
      description: glyphRequestMilestoneLabel(feedback.state),
    });
  }, [feedback, pendingAction]);

  useEffect(() => {
    if (!error) return;
    toast.error("Request not completed", { description: error });
    dismissFeedback();
  }, [dismissFeedback, error]);

  useEffect(() => {
    if (!notice) return;
    toast.success(notice);
    dismissFeedback();
  }, [dismissFeedback, notice]);

  useEffect(() => {
    return () => {
      if (pendingToast.current !== null) toast.dismiss(pendingToast.current);
    };
  }, []);

  return null;
}
