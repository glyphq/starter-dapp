"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { glyphRequestMilestoneLabel } from "@/lib/connectors/glyph";
import { Identicon } from "./identicon";
import { useWalletSession } from "./wallet-session-provider";

export function LoadingIcon() {
  return <span className="spinner" aria-hidden="true" />;
}

export function RequestStatus() {
  const {
    wallet,
    pendingAction,
    error,
    notice,
    noticeIdentity,
    feedback,
    dismissFeedback,
  } = useWalletSession();
  const pendingToast = useRef<string | number | null>(null);
  const identity = wallet.account?.identity;

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
      icon: identity ? <Identicon identity={identity} size={20} /> : undefined,
      description: "Keep this page open. Any approval happens in your wallet.",
    });
  }, [identity, pendingAction]);

  useEffect(() => {
    if (!pendingAction || !feedback || feedback.state === "completed") return;
    const id = pendingToast.current ?? "wallet-request";
    pendingToast.current = id;
    toast.loading(pendingAction, {
      id,
      icon: identity ? <Identicon identity={identity} size={20} /> : undefined,
      description: glyphRequestMilestoneLabel(feedback.state),
    });
  }, [feedback, identity, pendingAction]);

  useEffect(() => {
    if (!error) return;
    toast.error("Request not completed", {
      description: error,
      icon: identity ? <Identicon identity={identity} size={20} /> : undefined,
    });
    dismissFeedback();
  }, [dismissFeedback, error, identity]);

  useEffect(() => {
    if (!notice) return;
    toast.success(notice, {
      icon: noticeIdentity ? (
        <Identicon identity={noticeIdentity} size={20} />
      ) : undefined,
    });
    dismissFeedback();
  }, [dismissFeedback, notice, noticeIdentity]);

  useEffect(() => {
    return () => {
      if (pendingToast.current !== null) toast.dismiss(pendingToast.current);
    };
  }, []);

  return null;
}
