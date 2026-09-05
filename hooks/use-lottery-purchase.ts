"use client";

import { useEffect, useRef, useState } from "react";
import {
  pendingRandomLotteryPurchase,
  pollRandomLotteryPurchaseConfirmation,
  type RandomLotteryPurchaseConfirmation,
} from "@/lib/contracts/random-lottery-result";

/** Keep the last signed purchase visible across screen/account changes until reload. */
export function useLotteryPurchase() {
  const [purchase, setPurchase] = useState<{
    identity: string;
    confirmation: RandomLotteryPurchaseConfirmation;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  function trackPurchase(
    transactionId: string,
    targetTick: number | undefined,
    ticketPrice: bigint,
    identity: string,
  ) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setPurchase({
      identity,
      confirmation: pendingRandomLotteryPurchase(transactionId, targetTick),
    });
    void pollRandomLotteryPurchaseConfirmation({
      transactionId,
      ticketPrice,
      targetTick,
      signal: current.signal,
      onUpdate: (confirmation) => {
        if (!current.signal.aborted) setPurchase({ identity, confirmation });
      },
    }).catch(() => {
      if (!current.signal.aborted)
        setPurchase({
          identity,
          confirmation: {
            state: "unavailable",
            transactionId,
            message: "Archive unavailable. Check this transaction in Explorer.",
          },
        });
    });
  }

  return { purchase, trackPurchase };
}
