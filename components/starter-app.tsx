"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  LockKeyholeIcon,
  PenLineIcon,
  MoonIcon,
  SendIcon,
  SunIcon,
  WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/hooks/use-theme";
import { useWalletSession } from "@/components/wallet/wallet-session-provider";
import { AccountDialog } from "@/components/wallet/account-dialog";
import { WalletDialog } from "@/components/wallet/wallet-dialog";
import { LockQusScreen } from "@/components/qearn/lock-qus-screen";
import { SendToManyScreen } from "@/components/qutil/send-to-many-screen";
import { SignaturesScreen } from "@/components/signatures/signatures-screen";
import Plasma from "@/components/plasma";

export const referenceFlows = [
  { id: "sign-verify", label: "Sign & Verify" },
  { id: "lock-qus", label: "Lock QUs" },
  { id: "send-to-many", label: "Send to many" },
] as const;
type Flow = (typeof referenceFlows)[number]["id"];

/** Composition only: each screen owns its own form, request inputs and results. */
export function StarterApp() {
  const { wallet, pendingAction, openWalletDialog, dismissFeedback } =
    useWalletSession();
  const { theme, toggleTheme } = useTheme();
  const [task, setTask] = useState<Flow | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const updateScrolled = () => setScrolled(window.scrollY > 20);
    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);
  const sessionKey = `${wallet.activeConnector?.id ?? "none"}:${wallet.account?.identity ?? "none"}`;
  function openTask(next: Flow) {
    if (pendingAction) return;
    dismissFeedback();
    setTask(next);
  }
  function closeTask(open: boolean) {
    if (!open) {
      dismissFeedback();
      setTask(null);
    }
  }
  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header
        className="workspace-header"
        data-scrolled={scrolled ? "true" : undefined}
      >
        <div className="workspace-header-inner">
          <button
            className="workspace-brand"
            type="button"
            onClick={() => {
              setTask(null);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            disabled={Boolean(pendingAction)}
            aria-label="Glyph Starter home"
          >
            <Image
              className="glyph-mark"
              src="/brand/glyph-mark.png"
              alt=""
              width={28}
              height={28}
            />
            <span>
              <strong>Glyph Starter</strong>
            </span>
          </button>
          <div className="workspace-header-actions">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </Button>
            {wallet.account && wallet.activeConnector ? (
              <AccountDialog key={sessionKey} />
            ) : (
              <Button variant="outline" onClick={openWalletDialog}>
                <WalletIcon aria-hidden="true" />
                Connect wallet
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="workspace-main" id="main-content" tabIndex={-1}>
        <section className="starter-hero" aria-labelledby="starter-hero-title">
          <div className="starter-hero-plasma" aria-hidden="true">
            {!reducedMotion && (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  position: "relative",
                }}
              >
                <Plasma
                  color="#ffffff"
                  speed={0.4}
                  direction="forward"
                  scale={1}
                  opacity={1}
                  mouseInteractive={false}
                  iterations={80}
                  renderScale={0.4}
                  targetFps={60}
                  maxDpr={2}
                />
              </div>
            )}
          </div>
          <div className="starter-hero-copy">
            <h1 id="starter-hero-title">Build with Qubic.</h1>
            <p>Connect a wallet, sign a message, lock QUs, or send to many.</p>
            <div className="starter-hero-actions" aria-label="Starter examples">
              <Button
                onClick={() => openTask("sign-verify")}
                disabled={Boolean(pendingAction)}
              >
                <PenLineIcon aria-hidden="true" /> Sign &amp; Verify
              </Button>
              <Button
                variant="outline"
                onClick={() => openTask("lock-qus")}
                disabled={Boolean(pendingAction)}
              >
                <LockKeyholeIcon aria-hidden="true" /> Lock QUs
              </Button>
              <Button
                variant="outline"
                onClick={() => openTask("send-to-many")}
                disabled={Boolean(pendingAction)}
              >
                <SendIcon aria-hidden="true" /> Send to many
              </Button>
            </div>
          </div>
        </section>
        <Dialog open={task !== null} onOpenChange={closeTask}>
          <DialogContent className="task-dialog" aria-describedby={undefined}>
            <DialogHeader className="sr-only">
              <DialogTitle>
                {task === "sign-verify"
                  ? "Sign and verify"
                  : task === "lock-qus"
                    ? "Lock QUs"
                    : "Send to many"}
              </DialogTitle>
            </DialogHeader>
            {task === "sign-verify" && <SignaturesScreen />}
            {task === "lock-qus" && <LockQusScreen />}
            {task === "send-to-many" && <SendToManyScreen />}
          </DialogContent>
        </Dialog>
      </main>
      <WalletDialog />
    </div>
  );
}
