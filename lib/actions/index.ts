export * from "../contracts/action-types";
export * from "../contracts/qearn";
export * from "../contracts/qutil";

import { qearnActions } from "../contracts/qearn";
import { qutilActions } from "../contracts/qutil";

export const starterActions = [...qearnActions, ...qutilActions] as const;

export function getStarterAction(id: string) {
  return starterActions.find((action) => action.id === id);
}
