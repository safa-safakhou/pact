/** Game balances are stored in exact 1/600 units; display is a rounded projection only. */
export function wholeResourceAmount(internalUnits: string): number {
  return Number(internalUnits) / 600;
}
