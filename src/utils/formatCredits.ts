/** AI credits as Plan & usage shows them: two decimals, but no trailing ".00" on a whole number
 *  ("5", "1.83", "2.5"). One formatter for every surface that names an amount of credits, so a
 *  figure on an Inbox card reads exactly like the same figure in Settings. */
export const formatCredits = (value: number): string =>
    Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "");
