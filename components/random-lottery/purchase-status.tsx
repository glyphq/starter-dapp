import {
  QUBIC_EXPLORER_TRANSACTION_URL,
  type RandomLotteryPurchaseConfirmation,
} from "@/lib/contracts/random-lottery-result";
import { LoadingIcon } from "@/components/wallet/request-status";

export function RandomLotteryPurchaseStatus({
  confirmation,
}: {
  confirmation: RandomLotteryPurchaseConfirmation | null;
}) {
  if (!confirmation) return null;
  const explorerUrl = QUBIC_EXPLORER_TRANSACTION_URL(
    confirmation.transactionId,
  );

  return (
    <div
      className={`lottery-confirmation ${confirmation.state}`}
      role="status"
      aria-live="polite"
    >
      <div className="lottery-confirmation-heading">
        {confirmation.state === "pending" ? <LoadingIcon /> : null}
        <strong>
          {confirmation.state === "pending"
            ? "Waiting for network confirmation"
            : confirmation.state === "confirmed"
              ? "Transaction confirmed"
              : "Archive status unavailable"}
        </strong>
      </div>
      {confirmation.state === "pending" ? (
        <p>
          Glyph signed the BuyTicket call. The official Qubic archive is being
          checked.
        </p>
      ) : confirmation.state === "confirmed" ? (
        <>
          <div className="lottery-confirmation-data">
            {confirmation.tickNumber !== undefined && (
              <>
                <span>Confirmed tick</span>
                <code>{confirmation.tickNumber}</code>
              </>
            )}
            {confirmation.moneyFlew !== undefined && (
              <>
                <span>Archive money-flow signal</span>
                <code>
                  {confirmation.moneyFlew ? "funds moved" : "no funds moved"}
                </code>
              </>
            )}
          </div>
          <p>
            The official archive indexed this empty-payload BuyTicket call. Its
            public schema does not expose the contract return code, so this app
            does not claim an accepted or refunded entry.
          </p>
        </>
      ) : (
        <p>{confirmation.message}</p>
      )}
      <a href={explorerUrl} target="_blank" rel="noreferrer">
        View transaction in Qubic Explorer
      </a>
    </div>
  );
}
