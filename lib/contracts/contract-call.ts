import type { GlyphScCallInput } from "@/lib/connectors/glyph";

/**
 * A contract call stays registered in source, not assembled from unchecked
 * end-user values. Add an ABI-reviewed entry here when adapting the starter.
 */
export type ContractCallDefinition = {
  id: string;
  label: string;
  description: string;
  request: GlyphScCallInput;
};

export const CONTRACT_CALL_DEFINITIONS: readonly ContractCallDefinition[] = [
  {
    id: "zero-value-template",
    label: "Zero-value call",
    description:
      "A minimal typed request. Replace it with an ABI-reviewed contract action for your app.",
    request: {
      contractIndex: 0,
      inputType: 0,
      amount: "0",
    },
  },
];

export function contractCallDefinition(id: string) {
  return CONTRACT_CALL_DEFINITIONS.find((definition) => definition.id === id);
}

export function qubicExplorerTransactionUrl(transactionId: string) {
  return `https://explorer.qubic.org/network/mainnet/tx/${encodeURIComponent(transactionId)}`;
}
