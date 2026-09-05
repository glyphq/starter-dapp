import {
  buildRandomLotteryBuyTicketRequest,
  type RandomLotteryPreflight,
} from "./random-lottery";

export const LOTTERY_REVIEW_LIFETIME_MS = 30_000;
export type LotteryReview = {
  ticketPrice: bigint;
  identity: string;
  checkedAt: number;
};

export function createLotteryReview(
  preflight: RandomLotteryPreflight,
  identity: string,
  now = Date.now(),
): LotteryReview | null {
  if (preflight.state !== "open" || preflight.ticketPrice <= BigInt(0))
    return null;
  return { ticketPrice: preflight.ticketPrice, identity, checkedAt: now };
}

/** Reject stale/account-switched reviews synchronously, before any wallet launch. */
export function buildReviewedLotteryRequest(
  review: LotteryReview,
  identity: string,
  now = Date.now(),
) {
  const age = now - review.checkedAt;
  if (
    identity !== review.identity ||
    !Number.isFinite(age) ||
    age < 0 ||
    age >= LOTTERY_REVIEW_LIFETIME_MS
  ) {
    return null;
  }
  return buildRandomLotteryBuyTicketRequest(review.ticketPrice);
}
