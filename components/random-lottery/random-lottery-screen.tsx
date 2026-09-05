"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWalletSession } from "@/components/wallet/wallet-session-provider";
import { LoadingIcon } from "@/components/wallet/request-status";
import {
  requestGlyphScCall,
  isGlyphRelaySessionReady,
} from "@/lib/connectors/glyph";
import {
  fetchRandomLotteryPreflight,
  formatRandomLotteryTicketPrice,
  type RandomLotteryPreflight,
} from "@/lib/contracts/random-lottery";
import {
  createLotteryReview,
  buildReviewedLotteryRequest,
  LOTTERY_REVIEW_LIFETIME_MS,
  type LotteryReview,
} from "@/lib/contracts/random-lottery-review";
import type { useLotteryPurchase } from "@/hooks/use-lottery-purchase";
import { RandomLotteryPurchaseStatus } from "./purchase-status";

const unavailable: RandomLotteryPreflight = {
  state: "unavailable",
  message: "Live price could not be loaded. Refresh to try again.",
};

export function RandomLotteryScreen({
  purchaseState,
}: {
  purchaseState: ReturnType<typeof useLotteryPurchase>;
}) {
  const { wallet, pendingAction, runAction, prepareGlyph, openWalletDialog } =
    useWalletSession();
  const [preflight, setPreflight] = useState<RandomLotteryPreflight | null>(
    null,
  );
  const [review, setReview] = useState<LotteryReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const requestSequence = useRef(0);
  const isGlyph =
    wallet.activeConnector?.id === "glyph-wallet" && Boolean(wallet.account);

  useEffect(() => {
    active.current = true;
    const sequence = ++requestSequence.current;
    void fetchRandomLotteryPreflight()
      .catch(() => unavailable)
      .then((value) => {
        if (active.current && sequence === requestSequence.current)
          setPreflight(value);
      });
    return () => {
      active.current = false;
    };
  }, []);

  useEffect(() => {
    if (!review) return;
    const timer = setTimeout(
      () => {
        setReview(null);
        setError(
          "This price review expired. Review the latest price before opening your wallet.",
        );
      },
      Math.max(0, review.checkedAt + LOTTERY_REVIEW_LIFETIME_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [review]);

  function refresh() {
    setReview(null);
    setError(null);
    void runAction(
      "Refreshing contract",
      async () => {
        const sequence = ++requestSequence.current;
        const value = await fetchRandomLotteryPreflight().catch(
          () => unavailable,
        );
        if (active.current && sequence === requestSequence.current)
          setPreflight(value);
      },
      "Could not refresh the contract. Try again.",
    );
  }

  function reviewTicket() {
    if (!isGlyph || !wallet.account) return;
    const identity = wallet.account.identity;
    setReview(null);
    setError(null);
    void runAction(
      "Reviewing ticket price",
      async () => {
        const sequence = ++requestSequence.current;
        const value = await fetchRandomLotteryPreflight().catch(
          () => unavailable,
        );
        if (!active.current || sequence !== requestSequence.current) return;
        setPreflight(value);
        const nextReview = createLotteryReview(value, identity);
        if (!nextReview) {
          setError(
            value.state === "closed"
              ? "Ticket selling is closed. No wallet request was created."
              : "A valid live price is required. Refresh and try again.",
          );
          return;
        }
        await prepareGlyph();
        if (active.current) setReview(nextReview);
      },
      "Could not prepare this purchase. Check your connection and try again.",
    );
  }

  function openWallet() {
    if (!review || !wallet.account || !isGlyph) return;
    const request = buildReviewedLotteryRequest(
      review,
      wallet.account.identity,
    );
    if (!request || !isGlyphRelaySessionReady()) {
      setReview(null);
      setError("Review the latest price and prepare a secure session again.");
      return;
    }
    const ticketPrice = review.ticketPrice;
    setError(null);
    void runAction(
      "Waiting for purchase approval",
      async () => {
        // No awaited price fetch here. The reviewed request opens inside this click.
        const resultPromise = requestGlyphScCall(request);
        setReview(null);
        const { txId, targetTick } = await resultPromise;
        purchaseState.trackPurchase(
          txId,
          targetTick,
          ticketPrice,
          review.identity,
        );
      },
      "Purchase was not completed. Check your wallet and any previous transaction before trying again.",
    );
  }

  return (
    <section className="flow-panel" aria-labelledby="random-lottery-title">
      <div className="flow-heading">
        <span className="eyebrow">Contract example · mainnet</span>
        <h2 id="random-lottery-title">RandomLottery</h2>
        <p>
          Review the current ticket price, then choose whether to open your
          wallet. This is a real paid entry.
        </p>
      </div>
      <div className="price-summary">
        <div>
          <span className="data-label">Live ticket price</span>
          <strong>
            {preflight && preflight.state !== "unavailable"
              ? formatRandomLotteryTicketPrice(preflight.ticketPrice)
              : preflight
                ? "Unavailable"
                : "Loading…"}
          </strong>
        </div>
        <div>
          <span className="data-label">Selling state</span>
          <strong>
            {preflight?.state === "open"
              ? "Open"
              : preflight?.state === "closed"
                ? "Closed"
                : "Unavailable"}
          </strong>
        </div>
        <Button
          variant="outline"
          onClick={refresh}
          disabled={Boolean(pendingAction)}
        >
          Refresh price
        </Button>
      </div>
      <p className="help-text">
        BuyTicket · Contract 16 · input type 1 · empty payload
      </p>
      {preflight?.state === "unavailable" && (
        <p className="notice" role="status">
          {preflight.message}
        </p>
      )}
      {preflight?.state === "closed" && (
        <p className="notice" role="status">
          Ticket selling is closed. No purchase can be requested.
        </p>
      )}
      {!isGlyph && (
        <div className="notice">
          <strong>Glyph Wallet required</strong>
          <p>
            This contract example uses Glyph’s typed smart-contract request.
          </p>
          <Button
            variant="outline"
            onClick={openWalletDialog}
            disabled={Boolean(pendingAction)}
          >
            Choose wallet
          </Button>
        </div>
      )}
      {review ? (
        <div className="purchase-review" aria-label="Review ticket purchase">
          <span className="eyebrow">Review before you continue</span>
          <h3>
            One ticket · {formatRandomLotteryTicketPrice(review.ticketPrice)}
          </h3>
          <p>
            This quote is valid for 30 seconds from its price check. Contract
            state may change. Confirm the account, amount, and network in Glyph
            before approving.
          </p>
          <div className="form-actions">
            <Button onClick={openWallet} disabled={Boolean(pendingAction)}>
              Open Glyph Wallet
            </Button>
            <Button
              variant="outline"
              onClick={() => setReview(null)}
              disabled={Boolean(pendingAction)}
            >
              Cancel review
            </Button>
          </div>
        </div>
      ) : (
        <div className="form-actions">
          <Button
            onClick={reviewTicket}
            disabled={
              !isGlyph || Boolean(pendingAction) || preflight?.state !== "open"
            }
          >
            {pendingAction === "Reviewing ticket price" && <LoadingIcon />}
            Review ticket
          </Button>
          <span className="help-text">
            Reviewing does not submit a transaction.
          </span>
        </div>
      )}
      {error && (
        <p className="error-line" role="alert">
          {error}
        </p>
      )}
      {purchaseState.purchase && (
        <div>
          <p className="help-text">
            Last signed purchase · submitted account{" "}
            <code>
              {purchaseState.purchase.identity.slice(0, 8)}…
              {purchaseState.purchase.identity.slice(-8)}
            </code>
          </p>
          <RandomLotteryPurchaseStatus
            confirmation={purchaseState.purchase.confirmation}
          />
        </div>
      )}
      <p className="safety-note">
        Buying a ticket is not a guaranteed return. Archive confirmation does
        not prove a winning or refunded entry.
      </p>
    </section>
  );
}
