import { describe, expect, test } from "bun:test";
import {
  createLotteryReview,
  buildReviewedLotteryRequest,
  LOTTERY_REVIEW_LIFETIME_MS,
} from "./random-lottery-review";

const open = {
  state: "open",
  ticketPrice: BigInt(125),
  currentState: 1,
} as const;

describe("explicit lottery price review", () => {
  test("only prepares a review for an open sale with a positive price", () => {
    expect(
      createLotteryReview(
        { state: "closed", ticketPrice: BigInt(125), currentState: 0 },
        "account",
        100,
      ),
    ).toBeNull();
    expect(
      createLotteryReview(
        { state: "unavailable", message: "offline" },
        "account",
        100,
      ),
    ).toBeNull();
    expect(
      createLotteryReview({ ...open, ticketPrice: BigInt(0) }, "account", 100),
    ).toBeNull();
  });

  test("builds the exact reviewed amount synchronously, with no I/O or wallet launch", () => {
    const review = createLotteryReview(open, "account", 100)!;
    expect(buildReviewedLotteryRequest(review, "account", 101)).toEqual({
      contractIndex: 16,
      inputType: 1,
      payload: "",
      amount: "125",
    });
    expect(
      buildReviewedLotteryRequest(
        review,
        "account",
        100 + LOTTERY_REVIEW_LIFETIME_MS - 1,
      ),
    ).not.toBeNull();
  });

  test("blocks expired, future-dated, invalid-time and account-switched reviews", () => {
    const review = createLotteryReview(open, "account", 100)!;
    expect(
      buildReviewedLotteryRequest(
        review,
        "account",
        100 + LOTTERY_REVIEW_LIFETIME_MS,
      ),
    ).toBeNull();
    expect(buildReviewedLotteryRequest(review, "account", 99)).toBeNull();
    expect(
      buildReviewedLotteryRequest(review, "account", Number.NaN),
    ).toBeNull();
    expect(
      buildReviewedLotteryRequest(review, "another-account", 101),
    ).toBeNull();
  });
});
