import {
  RANDOM_LOTTERY_BUY_TICKET_INPUT_TYPE,
  RANDOM_LOTTERY_CONTRACT_INDEX,
  randomLotteryGetState,
  randomLotteryGetTicketPrice,
  type SmartContractCaller,
} from "@qubic.org/contracts";
import { createLiveClient } from "@qubic.org/rpc";
import type { GlyphScCallInput } from "@/lib/connectors/glyph";

/** The SELLING bit is defined by RandomLottery's official EState enum. */
export const RANDOM_LOTTERY_SELLING_STATE = 1;
const ZERO = BigInt(0);

export type RandomLotteryPreflight =
  | {
      state: "open";
      ticketPrice: bigint;
      currentState: number;
    }
  | {
      state: "closed";
      ticketPrice: bigint;
      currentState: number;
    }
  | {
      state: "unavailable";
      message: string;
    };

export type RandomLotteryLiveClient = SmartContractCaller;

/**
 * Reads the official live contract functions immediately before a purchase.
 * A ticket is purchasable only while the official SELLING state bit is set and
 * the live price is a positive uint64 value.
 */
export async function fetchRandomLotteryPreflight(
  live: RandomLotteryLiveClient = createLiveClient(),
): Promise<RandomLotteryPreflight> {
  const [priceResult, stateResult] = await Promise.all([
    randomLotteryGetTicketPrice(live),
    randomLotteryGetState(live),
  ]);

  if (!priceResult.ok || !stateResult.ok) {
    return {
      state: "unavailable",
      message: "Live RandomLottery price or selling state is unavailable. Try again shortly.",
    };
  }

  const ticketPrice = priceResult.value.ticketPrice;
  if (ticketPrice <= ZERO) {
    return {
      state: "unavailable",
      message: "RandomLottery returned an invalid live ticket price. No purchase can be requested.",
    };
  }

  const currentState = stateResult.value.currentState;
  return (currentState & RANDOM_LOTTERY_SELLING_STATE) === RANDOM_LOTTERY_SELLING_STATE
    ? { state: "open", ticketPrice, currentState }
    : { state: "closed", ticketPrice, currentState };
}

/** Builds the documented empty-payload BuyTicket procedure request. */
export function buildRandomLotteryBuyTicketRequest(ticketPrice: bigint): GlyphScCallInput {
  if (ticketPrice <= ZERO) throw new Error("A positive live ticket price is required.");

  return {
    contractIndex: RANDOM_LOTTERY_CONTRACT_INDEX,
    inputType: RANDOM_LOTTERY_BUY_TICKET_INPUT_TYPE,
    payload: "",
    amount: ticketPrice.toString(),
  };
}

export function formatRandomLotteryTicketPrice(ticketPrice: bigint) {
  return `${ticketPrice.toLocaleString()} QU`;
}
